import "server-only";
import fs from "fs";
import path from "path";
import type { Browser, BrowserContext, Locator, Page } from "playwright";
import { uid } from "@/lib/utils";
import { getServerConfig } from "@/lib/services/config";
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

// Both contexts (headed login + headless / headed send) must use the SAME
// browser fingerprint, otherwise LinkedIn flags the saved session as
// "different device" and throws the authwall. The shared options below
// are passed to BOTH newContext() calls.
const SHARED_CONTEXT_OPTIONS = {
  viewport: { width: 1366, height: 768 },
  locale: "en-US",
  // Intentionally NOT overriding userAgent — let Playwright use its
  // default Chromium UA so headed and headless contexts produce the
  // identical "device fingerprint" LinkedIn binds cookies to.
} as const;

async function getPlaywright() {
  return import("playwright");
}

async function launchForSend(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const pw = await getPlaywright();
  const cfg = getServerConfig();
  const browser = await pw.chromium.launch({
    headless: cfg.linkedin.playwright.headless,
    args: STEALTH_ARGS,
  });
  const context = await browser.newContext({
    ...SHARED_CONTEXT_OPTIONS,
    storageState: getSessionPath(),
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
  } catch (err) {
    console.error(
      `[playwright] screenshot save failed (${reason}):`,
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}

// Profile-area scope so we don't grab Connect/Follow/Message buttons that
// belong to the "More profiles for you" sidebar (other people's cards).
// Falls back to the page if we can't find the heading.
function profileScope(page: Page): Locator {
  return page.locator("section, main").filter({ has: page.locator("h1") }).first();
}

// Click a dropdown item by its visible label. LinkedIn's dropdown items
// are <div role="button"> inside .artdeco-dropdown__content, but the
// exact state-modifier class and DOM shape change frequently — so we
// scan every visible clickable element, match its trimmed text exactly,
// and verify it's inside a dropdown-like container (not the "More
// profiles for you" sidebar).
async function clickDropdownItem(
  page: Page,
  label: string,
  timeoutMs: number,
): Promise<boolean> {
  const wanted = label.toLowerCase();
  const candidates = await page
    .locator('[role="button"], [role="menuitem"], button, a, li[tabindex]')
    .all();
  for (const c of candidates) {
    const visible = await c.isVisible().catch(() => false);
    if (!visible) continue;
    const text = ((await c.textContent().catch(() => "")) ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (text !== wanted) continue;
    const insideDropdown = await c
      .evaluate((el) =>
        !!(el as Element).closest(
          '[class*="dropdown__content"],[class*="artdeco-dropdown"],[role="menu"],[role="listbox"]',
        ),
      )
      .catch(() => false);
    if (!insideDropdown) continue;
    await c.click({ timeout: timeoutMs });
    return true;
  }
  return false;
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
  // Scope to the profile's own action area so we don't pick up Connect /
  // Message / Follow buttons that belong to OTHER people in the "More
  // profiles for you" sidebar.
  const scope = profileScope(page);
  const result: ActionAreaButtons = {};

  const connectDirect = scope
    .getByRole("button", { name: /^Connect( to|$|\s)/i })
    .first();
  if (await connectDirect.isVisible({ timeout: 1500 }).catch(() => false)) {
    result.connectDirect = connectDirect;
  }

  const pending = scope.getByRole("button", { name: /^Pending/i }).first();
  if (await pending.isVisible({ timeout: 500 }).catch(() => false)) {
    result.pending = pending;
  }

  const message = scope.getByRole("button", { name: /^Message$/i }).first();
  if (await message.isVisible({ timeout: 500 }).catch(() => false)) {
    result.message = message;
  }

  const moreActions = scope
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
    const { browser, context } = await launchForSend();
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
        await sleep(900 + Math.random() * 500);
        await saveDebugScreenshot(page, "after-more-click");
        clicked = await clickDropdownItem(page, "Connect", ACTION_TIMEOUT_MS);
      }

      if (!clicked) {
        const screenshot = await saveDebugScreenshot(
          page,
          "no-connect-button",
        );
        return {
          success: false,
          provider: this.provider,
          error: `Couldn't find a Connect option for this profile. The More menu may not have opened, or this account doesn't allow connection requests from your tier. Screenshot: ${screenshot ?? "(failed to capture — check console for error)"}`,
        };
      }

      // After clicking Connect, LinkedIn opens an invitation dialog.
      // Wait for it to appear — if it never does, the request was NOT
      // sent (regardless of how the previous click looked).
      await sleep(1200);
      const dialog = page.locator('[role="dialog"]').first();
      const dialogOpened = await dialog
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (!dialogOpened) {
        const screenshot = await saveDebugScreenshot(page, "no-invite-dialog");
        return {
          success: false,
          provider: this.provider,
          error: `Clicked Connect but the invitation dialog never opened. LinkedIn may have rate-limited connections, or the "Connect" item in the More menu was actually labeled differently (e.g. "Remove Connection"). Screenshot: ${screenshot}`,
        };
      }
      await saveDebugScreenshot(page, "invite-dialog");

      // If we have a note and the dialog accepts one, fill it.
      if (input.note) {
        const directBox = dialog.locator('textarea, [role="textbox"]').first();
        let composed = false;
        if (await directBox.isVisible({ timeout: 1500 }).catch(() => false)) {
          await directBox.click().catch(() => {});
          await sleep(200);
          for (const ch of input.note.slice(0, 200)) {
            await page.keyboard.type(ch);
            await sleep(keystrokeDelay());
          }
          composed = true;
        }
        if (!composed) {
          const addNote = dialog
            .getByRole("button", { name: /add (a |free )?note/i })
            .first();
          if (
            await addNote.isVisible({ timeout: 1500 }).catch(() => false)
          ) {
            await addNote.click({ timeout: ACTION_TIMEOUT_MS });
            await sleep(500);
            const box = dialog
              .locator('textarea, [role="textbox"]')
              .first();
            if (await box.isVisible({ timeout: 2000 }).catch(() => false)) {
              for (const ch of input.note.slice(0, 200)) {
                await page.keyboard.type(ch);
                await sleep(keystrokeDelay());
              }
            }
          }
        }
      }

      // Click whichever "send" variant LinkedIn shows in this dialog.
      // Try most specific first. NEVER fall through to a generic page
      // button — must be inside the dialog so we don't click navbar.
      const sendLabels = [
        /^Send invitation$/i,
        /^Send now$/i,
        /^Send$/i,
        /^Send without (a )?note$/i,
        /^Send anyway$/i,
      ];
      let sendClicked = false;
      for (const label of sendLabels) {
        const btn = dialog.getByRole("button", { name: label }).first();
        if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
          await btn.click({ timeout: ACTION_TIMEOUT_MS });
          sendClicked = true;
          break;
        }
      }
      if (!sendClicked) {
        const screenshot = await saveDebugScreenshot(
          page,
          "no-send-in-dialog",
        );
        return {
          success: false,
          provider: this.provider,
          error: `Invitation dialog opened but no Send button matched (looked for: Send invitation / Send now / Send / Send without note / Send anyway). Screenshot: ${screenshot}`,
        };
      }

      // The dialog dismissing is LinkedIn's confirmation that the invite
      // was queued. If the dialog stays open, the request did NOT go
      // through (e.g. weekly limit reached, error toast inside dialog).
      const dismissed = await dialog
        .waitFor({ state: "hidden", timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      if (!dismissed) {
        const screenshot = await saveDebugScreenshot(page, "dialog-stuck");
        return {
          success: false,
          provider: this.provider,
          error: `Clicked Send but the invitation dialog didn't dismiss — the request was NOT sent. LinkedIn often does this when you've hit the weekly connection-request limit. Screenshot: ${screenshot}`,
        };
      }
      await sleep(1200);
      await saveDebugScreenshot(page, "after-send");

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
    const { browser, context } = await launchForSend();
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
  const context = await browser.newContext(SHARED_CONTEXT_OPTIONS);
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

// Diagnostic helper: opens a profile with the saved session, reports
// what we actually see (final URL after redirects, profile heading,
// top-card action buttons), then clicks the More dropdown if present and
// reports what's inside it. Saves screenshots throughout.
export async function diagnoseProfile(profileUrl: string): Promise<{
  ok: boolean;
  finalUrl: string;
  heading: string | null;
  profileButtons: string[];
  moreMenuItems: string[];
  buttons: string[];
  screenshot?: string;
  moreMenuScreenshot?: string;
  error?: string;
}> {
  if (!hasSavedSession()) {
    return {
      ok: false,
      finalUrl: "",
      heading: null,
      profileButtons: [],
      moreMenuItems: [],
      buttons: [],
      error: "No saved LinkedIn session.",
    };
  }
  const { browser, context } = await launchForSend();
  try {
    const loaded = await openProfile(context, profileUrl);
    if (!loaded.ok) {
      return {
        ok: false,
        finalUrl: "",
        heading: null,
        profileButtons: [],
        moreMenuItems: [],
        buttons: [],
        screenshot: loaded.screenshot,
        error: loaded.reason,
      };
    }
    const { page } = loaded;
    const heading = await page
      .locator("h1")
      .first()
      .textContent()
      .catch(() => null);

    // Buttons in the profile's own action area (excludes sidebar Connects).
    const scope = profileScope(page);
    const profileButtonTexts = await scope
      .getByRole("button")
      .allTextContents()
      .catch(() => [] as string[]);
    const profileButtons = profileButtonTexts
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length < 60);

    // Whole-page buttons, for comparison.
    const allButtonTexts = await page
      .getByRole("button")
      .allTextContents()
      .catch(() => [] as string[]);
    const buttons = allButtonTexts
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length < 50)
      .slice(0, 25);

    const screenshot = await saveDebugScreenshot(page, "diagnose-ok");

    // If a More button exists in the profile area, click it and report
    // what the dropdown contains. This is the path most likely to fail.
    let moreMenuItems: string[] = [];
    let moreMenuScreenshot: string | undefined;
    const moreButton = scope
      .getByRole("button", { name: /^More( actions)?$/i })
      .first();
    if (await moreButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await moreButton.click({ timeout: ACTION_TIMEOUT_MS }).catch(() => {});
      await sleep(800);
      moreMenuScreenshot = await saveDebugScreenshot(page, "diagnose-more-open");
      const menuItemTexts = await page
        .locator(
          '.artdeco-dropdown__content--is-open, [role="menu"][aria-hidden="false"], [role="menu"]:not([aria-hidden="true"])',
        )
        .locator('[role="button"], [role="menuitem"], button, a, li, span')
        .allTextContents()
        .catch(() => [] as string[]);
      moreMenuItems = menuItemTexts
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length < 60);
      // Close the menu so the screenshot of the page doesn't get sticky.
      await page.keyboard.press("Escape").catch(() => {});
    }

    return {
      ok: true,
      finalUrl: page.url(),
      heading: heading ? heading.trim() : null,
      profileButtons,
      moreMenuItems,
      buttons,
      screenshot,
      moreMenuScreenshot,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
