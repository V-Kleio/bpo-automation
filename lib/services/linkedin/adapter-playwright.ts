import "server-only";
import fs from "fs";
import path from "path";
import type { Browser, BrowserContext, Page } from "playwright";
import { uid } from "@/lib/utils";
import {
  ensureSessionDir,
  getSessionPath,
  hasSavedSession,
} from "./session-store";
import { keystrokeDelay, sleep } from "./jitter";
import type {
  LinkedInAdapter,
  SendConnectionInput,
  SendMessageInput,
  SendResult,
} from "./types";

const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
];

const PROFILE_LOAD_TIMEOUT_MS = 25_000;
const ACTION_TIMEOUT_MS = 12_000;
const SCREENSHOT_DIR = path.resolve(process.cwd(), ".data/linkedin/screenshots");

async function getPlaywright() {
  return import("playwright");
}

async function launchHeadless(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const pw = await getPlaywright();
  const browser = await pw.chromium.launch({
    headless: true,
    args: STEALTH_ARGS,
  });
  const context = await browser.newContext({
    storageState: getSessionPath(),
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  return { browser, context };
}

async function saveDebugScreenshot(
  page: Page,
  reason: string,
): Promise<string | undefined> {
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const fileName = `${Date.now()}-${reason}.png`;
    const fullPath = path.join(SCREENSHOT_DIR, fileName);
    await page.screenshot({ path: fullPath, fullPage: false });
    return fullPath;
  } catch {
    return undefined;
  }
}

function isProfileUrl(url: string): boolean {
  return /linkedin\.com\/in\/[\w\-_%.]+/.test(url);
}

interface ProfileLoadOk {
  ok: true;
  page: Page;
}

interface ProfileLoadFail {
  ok: false;
  reason: string;
  screenshot?: string;
}

async function openProfile(
  context: BrowserContext,
  profileUrl: string,
): Promise<ProfileLoadOk | ProfileLoadFail> {
  const page = await context.newPage();
  try {
    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: PROFILE_LOAD_TIMEOUT_MS,
    });
  } catch (err) {
    const screenshot = await saveDebugScreenshot(page, "goto-failed");
    return {
      ok: false,
      reason: `Failed to navigate to ${profileUrl}: ${err instanceof Error ? err.message : String(err)}`,
      screenshot,
    };
  }

  // Wait briefly for client-side redirects to settle.
  await sleep(2000);

  // Handle LinkedIn's interstitial "Continue to LinkedIn" if it appears.
  const continueButton = page.getByRole("link", { name: /^continue/i });
  if (await continueButton.first().isVisible({ timeout: 1000 }).catch(() => false)) {
    await continueButton.first().click().catch(() => {});
    await sleep(2000);
  }

  // Detect login redirect — session expired.
  const currentUrl = page.url();
  if (/\/login|\/checkpoint|\/uas\//.test(currentUrl)) {
    const screenshot = await saveDebugScreenshot(page, "session-expired");
    return {
      ok: false,
      reason:
        "LinkedIn redirected to a login or checkpoint page — the saved session is no longer valid. Click 'Disconnect' on the Connect LinkedIn badge, then 'Connect LinkedIn' again to log in fresh.",
      screenshot,
    };
  }

  // If we ended up on the feed/home, something redirected us off the profile.
  if (!isProfileUrl(currentUrl)) {
    const screenshot = await saveDebugScreenshot(page, "redirected-off-profile");
    return {
      ok: false,
      reason: `Expected a profile page but landed on ${currentUrl}. The profile URL may be invalid, the profile may be private, or LinkedIn redirected for anti-automation reasons. Screenshot saved.`,
      screenshot,
    };
  }

  // Wait for the profile heading (the person's name) to appear — strongest
  // signal that the profile is actually rendered.
  try {
    await page
      .locator("h1")
      .first()
      .waitFor({ state: "visible", timeout: PROFILE_LOAD_TIMEOUT_MS });
  } catch {
    const screenshot = await saveDebugScreenshot(page, "no-h1-on-profile");
    return {
      ok: false,
      reason:
        "Profile page loaded but the name heading never became visible — page may be partially rendered or blocked.",
      screenshot,
    };
  }

  // Small randomized scroll to look more human.
  await page.mouse.move(400 + Math.random() * 200, 300 + Math.random() * 200);
  await page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 200));
  await sleep(800 + Math.random() * 800);

  return { ok: true, page };
}

interface ActionAreaButtons {
  connectDirect?: ReturnType<Page["getByRole"]>;
  pending?: ReturnType<Page["getByRole"]>;
  message?: ReturnType<Page["getByRole"]>;
  moreActions?: ReturnType<Page["getByRole"]>;
}

async function findActionButtons(page: Page): Promise<ActionAreaButtons> {
  // Scope to the top-card region where the primary action buttons live.
  // The exact selector changes over time, so we fall back to whole-page roles.
  const result: ActionAreaButtons = {};

  // Direct Connect button — present on accounts you can connect with directly.
  const connectDirect = page
    .getByRole("button", { name: /^Connect( to|$|\s)/i })
    .first();
  if (await connectDirect.isVisible({ timeout: 1500 }).catch(() => false)) {
    result.connectDirect = connectDirect;
  }

  const pending = page.getByRole("button", { name: /^Pending/i }).first();
  if (await pending.isVisible({ timeout: 500 }).catch(() => false)) {
    result.pending = pending;
  }

  const message = page.getByRole("button", { name: /^Message$/i }).first();
  if (await message.isVisible({ timeout: 500 }).catch(() => false)) {
    result.message = message;
  }

  // "More actions" button (three-dot menu). LinkedIn labels this as "More"
  // and sometimes "More actions". Scope to buttons in the top-card area.
  const moreActions = page
    .getByRole("button", { name: /^More( actions)?$/i })
    .first();
  if (await moreActions.isVisible({ timeout: 500 }).catch(() => false)) {
    result.moreActions = moreActions;
  }

  return result;
}

export class PlaywrightLinkedInAdapter implements LinkedInAdapter {
  readonly provider = "playwright" as const;

  isConfigured(): boolean {
    return hasSavedSession();
  }

  isAuthenticated(): boolean {
    return hasSavedSession();
  }

  async sendConnectionRequest(
    input: SendConnectionInput,
  ): Promise<SendResult> {
    if (!hasSavedSession()) {
      return {
        success: false,
        provider: this.provider,
        error:
          "No saved LinkedIn session. Click 'Connect LinkedIn' to log in first.",
      };
    }
    const { browser, context } = await launchHeadless();
    try {
      const loaded = await openProfile(context, input.profileUrl);
      if (!loaded.ok) {
        return {
          success: false,
          provider: this.provider,
          error:
            loaded.reason +
            (loaded.screenshot ? ` (screenshot: ${loaded.screenshot})` : ""),
        };
      }
      const { page } = loaded;
      const buttons = await findActionButtons(page);

      if (buttons.pending) {
        return {
          success: true,
          externalId: uid("pw-conn-already"),
          provider: this.provider,
        };
      }

      let clicked = false;
      if (buttons.connectDirect) {
        await buttons.connectDirect.click({ timeout: ACTION_TIMEOUT_MS });
        clicked = true;
      } else if (buttons.moreActions) {
        await buttons.moreActions.click({ timeout: ACTION_TIMEOUT_MS });
        await sleep(500 + Math.random() * 500);
        const connectInMenu = page
          .getByRole("menuitem", { name: /^Connect/i })
          .first();
        if (
          await connectInMenu
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await connectInMenu.click({ timeout: ACTION_TIMEOUT_MS });
          clicked = true;
        }
      }

      if (!clicked) {
        const screenshot = await saveDebugScreenshot(
          page,
          "no-connect-button",
        );
        return {
          success: false,
          provider: this.provider,
          error: `Couldn't find a Connect button on this profile. LinkedIn may show "Follow" instead (means we need to use the More menu, which also wasn't found), or you may already be connected. Screenshot: ${screenshot ?? "(failed to capture)"}`,
        };
      }

      // Optional connection note dialog.
      if (input.note) {
        const addNote = page.getByRole("button", { name: /add a note/i });
        if (await addNote.isVisible({ timeout: 2500 }).catch(() => false)) {
          await addNote.click({ timeout: ACTION_TIMEOUT_MS });
          const textarea = page.getByRole("textbox").first();
          for (const ch of input.note.slice(0, 280)) {
            await textarea.type(ch);
            await sleep(keystrokeDelay());
          }
        }
      }

      const send = page.getByRole("button", { name: /^Send( now)?$/i }).first();
      if (await send.isVisible({ timeout: 5000 }).catch(() => false)) {
        await send.click({ timeout: ACTION_TIMEOUT_MS });
      } else {
        // Some flows have an automatic send when no note is added.
        const sendWithoutNote = page
          .getByRole("button", { name: /send without/i })
          .first();
        if (
          await sendWithoutNote
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          await sendWithoutNote.click({ timeout: ACTION_TIMEOUT_MS });
        }
      }
      await sleep(1500);

      return {
        success: true,
        externalId: uid("pw-conn"),
        provider: this.provider,
      };
    } catch (err) {
      return {
        success: false,
        provider: this.provider,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }

  async sendDirectMessage(input: SendMessageInput): Promise<SendResult> {
    if (!hasSavedSession()) {
      return {
        success: false,
        provider: this.provider,
        error:
          "No saved LinkedIn session. Click 'Connect LinkedIn' to log in first.",
      };
    }
    const { browser, context } = await launchHeadless();
    try {
      const loaded = await openProfile(context, input.profileUrl);
      if (!loaded.ok) {
        return {
          success: false,
          provider: this.provider,
          error:
            loaded.reason +
            (loaded.screenshot ? ` (screenshot: ${loaded.screenshot})` : ""),
        };
      }
      const { page } = loaded;
      const buttons = await findActionButtons(page);

      if (!buttons.message) {
        const screenshot = await saveDebugScreenshot(page, "no-message-button");
        return {
          success: false,
          provider: this.provider,
          error: `Couldn't find a Message button on this profile. You may need to be connected first, or LinkedIn may have restricted messaging this account. Screenshot: ${screenshot ?? "(failed to capture)"}`,
        };
      }

      await buttons.message.click({ timeout: ACTION_TIMEOUT_MS });
      await sleep(800 + Math.random() * 400);

      const composer = page.getByRole("textbox", { name: /message|write/i }).first();
      await composer.waitFor({ state: "visible", timeout: 5000 });
      for (const ch of input.body) {
        await composer.type(ch);
        await sleep(keystrokeDelay());
      }

      await page
        .getByRole("button", { name: /^Send$/i })
        .first()
        .click({ timeout: ACTION_TIMEOUT_MS });
      await sleep(1200);

      return {
        success: true,
        externalId: uid("pw-dm"),
        provider: this.provider,
      };
    } catch (err) {
      const screenshot = await saveDebugScreenshot(
        await context.newPage().catch(() => null) as Page,
        "dm-failed",
      ).catch(() => undefined);
      return {
        success: false,
        provider: this.provider,
        error:
          (err instanceof Error ? err.message : String(err)) +
          (screenshot ? ` (screenshot: ${screenshot})` : ""),
      };
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

// Headed-login flow: open a real browser window so the user can log in
// manually. Resolves when LinkedIn navigates to /feed/, after which we
// save storageState and close the browser.
export async function runHeadedLogin(options: {
  onSuccess: () => void;
  onFailure: (msg: string) => void;
  abortSignal: { aborted: boolean };
}): Promise<{ cancel: () => Promise<void> }> {
  ensureSessionDir();
  const pw = await getPlaywright();
  const browser = await pw.chromium.launch({
    headless: false,
    args: STEALTH_ARGS,
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });

  // Detached watcher: wait up to ~10 min for the user to land on the feed.
  (async () => {
    try {
      await page.waitForURL(/linkedin\.com\/(feed|in)\//, { timeout: 600_000 });
      if (options.abortSignal.aborted) {
        options.onFailure("Login cancelled");
        return;
      }
      await context.storageState({ path: getSessionPath() });
      options.onSuccess();
    } catch (err) {
      options.onFailure(err instanceof Error ? err.message : String(err));
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  })();

  return {
    async cancel() {
      options.abortSignal.aborted = true;
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

// Diagnostic helper: opens a profile with the saved session and reports
// what we actually see (final URL after redirects, whether the profile
// heading rendered, which action buttons are visible). Saves a screenshot.
export async function diagnoseProfile(profileUrl: string): Promise<{
  ok: boolean;
  finalUrl: string;
  heading: string | null;
  buttons: string[];
  screenshot?: string;
  error?: string;
}> {
  if (!hasSavedSession()) {
    return {
      ok: false,
      finalUrl: "",
      heading: null,
      buttons: [],
      error: "No saved LinkedIn session.",
    };
  }
  const { browser, context } = await launchHeadless();
  try {
    const loaded = await openProfile(context, profileUrl);
    if (!loaded.ok) {
      return {
        ok: false,
        finalUrl: "",
        heading: null,
        buttons: [],
        screenshot: loaded.screenshot,
        error: loaded.reason,
      };
    }
    const { page } = loaded;
    const heading = await page.locator("h1").first().textContent().catch(() => null);
    const buttonTexts = await page
      .getByRole("button")
      .allTextContents()
      .catch(() => [] as string[]);
    const visibleButtons = buttonTexts
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length < 50)
      .slice(0, 20);
    const screenshot = await saveDebugScreenshot(page, "diagnose-ok");
    return {
      ok: true,
      finalUrl: page.url(),
      heading: heading ? heading.trim() : null,
      buttons: visibleButtons,
      screenshot,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
