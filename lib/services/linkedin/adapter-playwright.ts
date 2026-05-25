import "server-only";
import type { Browser, BrowserContext } from "playwright";
import { uid } from "@/lib/utils";
import {
  ensureSessionDir,
  getSessionPath,
  hasSavedSession,
} from "./session-store";
import { keystrokeDelay, randomDelayMs, sleep } from "./jitter";
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

async function getPlaywright() {
  return import("playwright");
}

async function launchHeadless(): Promise<{ browser: Browser; context: BrowserContext }> {
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

export class PlaywrightLinkedInAdapter implements LinkedInAdapter {
  readonly provider = "playwright" as const;

  isConfigured(): boolean {
    // Configured means: Playwright path is enabled AND a session exists.
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
        error: "No saved LinkedIn session. Connect first.",
      };
    }
    const { browser, context } = await launchHeadless();
    try {
      const page = await context.newPage();
      await page.goto(input.profileUrl, { waitUntil: "domcontentloaded" });
      await sleep(1500 + Math.random() * 1500);

      // The Connect button may be primary or under a "More" menu.
      const connectButton = page.getByRole("button", { name: /^Connect/i });
      if (await connectButton.first().isVisible({ timeout: 4000 }).catch(() => false)) {
        await connectButton.first().click();
      } else {
        await page.getByRole("button", { name: /more/i }).first().click();
        await sleep(400 + Math.random() * 400);
        await page.getByRole("menuitem", { name: /^Connect/i }).first().click();
      }

      if (input.note) {
        const addNote = page.getByRole("button", { name: /add a note/i });
        if (await addNote.isVisible({ timeout: 2000 }).catch(() => false)) {
          await addNote.click();
          const textarea = page.getByRole("textbox");
          for (const ch of input.note) {
            await textarea.type(ch);
            await sleep(keystrokeDelay());
          }
        }
      }

      const send = page.getByRole("button", { name: /^Send/i });
      await send.click({ timeout: 8000 });
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
        error: "No saved LinkedIn session. Connect first.",
      };
    }
    const { browser, context } = await launchHeadless();
    try {
      const page = await context.newPage();
      await page.goto(input.profileUrl, { waitUntil: "domcontentloaded" });
      await sleep(1500 + Math.random() * 1500);

      const messageButton = page.getByRole("button", { name: /^Message/i });
      await messageButton.first().click({ timeout: 8000 });
      await sleep(800);

      const composer = page.getByRole("textbox", { name: /message/i });
      for (const ch of input.body) {
        await composer.type(ch);
        await sleep(keystrokeDelay());
      }

      await page.getByRole("button", { name: /^Send/i }).click({ timeout: 5000 });
      await sleep(1200);

      return {
        success: true,
        externalId: uid("pw-dm"),
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

  await sleep(randomDelayMs() / 60); // small initial pause
  return {
    async cancel() {
      options.abortSignal.aborted = true;
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}
