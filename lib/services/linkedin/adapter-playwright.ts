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
import {
  truncateNote,
  type LinkedInAdapter,
  type SendConnectionInput,
  type SendMessageInput,
  type SendResult,
} from "./types";

const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-sandbox",
];

const PROFILE_LOAD_TIMEOUT_MS = 25_000;
const ACTION_TIMEOUT_MS = 12_000;
const SCREENSHOT_DIR = path.resolve(process.cwd(), ".data/linkedin/screenshots");

// Once a free account hits its custom-note quota, every subsequent send in
// this process will too. Remember it so we skip the failure-prone
// "Add a note" → Premium-upsell → reopen-Connect dance and go straight to
// "Send without a note" on the first invitation dialog. Resets on restart.
let freeNoteQuotaExhausted = false;

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
  pending?: ReturnType<Page["getByRole"]>;
  message?: ReturnType<Page["getByRole"]>;
  moreActions?: ReturnType<Page["getByRole"]>;
}

const CONNECT_MARKER_ATTR = "data-bpo-connect-target";

interface ConnectCandidate {
  tag: string;
  ariaLabel: string;
  text: string;
  inSidebar: boolean;
  reason: string;
}

interface FindConnectResult {
  found: boolean;
  via: string | null;
  candidates: ConnectCandidate[];
}

// Walks the page in the browser context to find the profile's Connect
// button. We do this in `page.evaluate` rather than chaining Playwright
// locators because LinkedIn varies the button's role, aria-label, and
// surrounding scope across A/B variants — and we've already lost
// twice to scoped queries returning empty. The walker:
//   1. Enumerates every visible <button> / [role="button"].
//   2. Matches by visible text === "Connect" OR aria-label matching
//      "Invite <Name> to connect" / "Connect" / "Connect <verb>".
//   3. Drops candidates inside <aside> or recommendations containers
//      so we don't invite someone from the "More profiles for you"
//      rail by accident.
//   4. Prefers a candidate whose aria-label contains the profile
//      owner's first name (most-specific signal).
//   5. Tags the winner with a data attribute we then click via the
//      Playwright Locator (preserves real mouse-event semantics).
// On failure, returns the candidate list so the caller can surface a
// useful diagnostic instead of a generic "couldn't find Connect".
async function findAndMarkConnectButton(
  page: Page,
  firstName?: string,
): Promise<FindConnectResult> {
  // Clear any previous marker before we search again.
  await page
    .evaluate((attr) => {
      document.querySelectorAll(`[${attr}]`).forEach((el) => {
        el.removeAttribute(attr);
      });
    }, CONNECT_MARKER_ATTR)
    .catch(() => {});

  return page.evaluate(
    ({ markerAttr, firstNameRaw }) => {
      const firstName = (firstNameRaw ?? "").trim().toLowerCase();

      const isVisible = (el: Element): boolean => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        if (
          style.visibility === "hidden" ||
          style.display === "none" ||
          style.opacity === "0"
        )
          return false;
        return true;
      };

      const classNameOf = (el: Element): string => {
        const raw = (el as HTMLElement).className;
        return typeof raw === "string" ? raw : "";
      };

      // Tight sidebar detection. The previous patterns (recommend,
      // suggested, similar-profile) were too broad and could match
      // ancestors of the legitimate top-card Connect button. Keep ONLY
      // explicit "right rail" markers.
      const isInSidebar = (el: Element): boolean => {
        if (el.closest("aside")) return true;
        const STRONG_PATTERNS = [
          "scaffold-layout__aside",
          "people-you-may-know",
          "browsemap-recommendation",
          "pymk-list",
        ];
        let cur: Element | null = el;
        while (cur) {
          const cls = classNameOf(cur).toLowerCase();
          for (const p of STRONG_PATTERNS) {
            if (cls.includes(p)) return true;
          }
          cur = cur.parentElement;
        }
        return false;
      };

      const h1 = document.querySelector("h1");
      const h1Rect = h1 ? (h1 as HTMLElement).getBoundingClientRect() : null;
      const h1Center = h1Rect ? h1Rect.top + h1Rect.height / 2 : 0;

      const candidates: ConnectCandidate[] = [];
      const winners: Array<{
        el: HTMLElement;
        ariaLabel: string;
        text: string;
        reason: string;
        distanceToH1: number;
      }> = [];

      const all = Array.from(
        document.querySelectorAll('button, [role="button"]'),
      );
      for (const el of all) {
        if (!isVisible(el)) continue;
        const ariaLabel = (el.getAttribute("aria-label") ?? "").trim();
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        const ariaLower = ariaLabel.toLowerCase();
        const textLower = text.toLowerCase();

        let reason = "";
        if (textLower === "connect") reason = "text=Connect";
        else if (/^invite\s+.+\s+to connect$/.test(ariaLower))
          reason = "aria=Invite … to connect";
        else if (ariaLower === "connect") reason = "aria=Connect";
        else if (/^connect( to|\s)/.test(ariaLower))
          reason = "aria starts Connect";
        else continue;

        const inSidebar = isInSidebar(el);
        const rect = (el as HTMLElement).getBoundingClientRect();
        const distanceToH1 = h1Rect
          ? Math.abs(rect.top + rect.height / 2 - h1Center)
          : Number.POSITIVE_INFINITY;
        candidates.push({
          tag: el.tagName,
          ariaLabel: ariaLabel.slice(0, 80),
          text: text.slice(0, 80),
          inSidebar,
          reason,
        });
        if (!inSidebar) {
          winners.push({
            el: el as HTMLElement,
            ariaLabel,
            text,
            reason,
            distanceToH1,
          });
        }
      }

      if (winners.length === 0) {
        return { found: false, via: null, candidates };
      }

      // Pick the Connect button geometrically closest to the profile's
      // h1 — that's almost always the top-card primary Connect, even if
      // LinkedIn renames classes or restructures the action row.
      winners.sort((a, b) => a.distanceToH1 - b.distanceToH1);
      let winner = winners[0];
      let via = `spatial-nearest-h1 (${winner.reason}, ${Math.round(winner.distanceToH1)}px)`;

      // If we have the profile owner's first name AND an aria-label
      // match for it exists, prefer that — it's still the strongest
      // semantic signal.
      if (firstName.length > 0) {
        const named = winners.find((w) =>
          w.ariaLabel.toLowerCase().includes(firstName),
        );
        if (named) {
          winner = named;
          via = `firstName-aria-match (${named.reason})`;
        }
      }

      winner.el.setAttribute(markerAttr, "1");
      return { found: true, via, candidates };
    },
    { markerAttr: CONNECT_MARKER_ATTR, firstNameRaw: firstName ?? null },
  );
}

// Detects LinkedIn's "free custom notes exhausted" upsell dialog and
// closes it. Returns true if an upsell was visible and dismissed.
async function dismissPremiumUpsellIfPresent(page: Page): Promise<boolean> {
  const upsell = page
    .locator('[role="dialog"]')
    .filter({
      hasText:
        /out of free.*notes?|unlimited personalized invites|try premium for/i,
    })
    .first();
  if (!(await upsell.isVisible({ timeout: 500 }).catch(() => false))) {
    return false;
  }
  // Try a labeled close button first.
  const labeled = upsell
    .getByRole("button", { name: /^(close|dismiss)$/i })
    .first();
  if (await labeled.isVisible({ timeout: 300 }).catch(() => false)) {
    await labeled.click({ timeout: 3000 }).catch(() => {});
  } else {
    const ariaClose = upsell
      .locator(
        'button[aria-label*="close" i], button[aria-label*="dismiss" i]',
      )
      .first();
    if (await ariaClose.isVisible({ timeout: 300 }).catch(() => false)) {
      await ariaClose.click({ timeout: 3000 }).catch(() => {});
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  // Wait for the upsell to actually disappear.
  await upsell.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  await sleep(400);
  return true;
}

// Fill the invitation note. Handles both dialog variants:
//   - textbox already visible in current dialog → focus + type
//   - need to click "Add a note" first → wait for textbox, focus + type
// Always focuses the textbox explicitly because LinkedIn doesn't always
// auto-focus after the dialog transition, which would mean
// page.keyboard.type would send keys into the void.
//
// Returns hitFreeNoteLimit=true when LinkedIn shows the Premium upsell
// instead of the textbox — the caller should retry without a note.
async function fillInvitationNote(
  page: Page,
  dialog: Locator,
  noteText: string,
): Promise<{ ok: boolean; reason: string; hitFreeNoteLimit?: boolean }> {
  const trimmed = truncateNote(noteText);

  let textbox = dialog.locator('textarea, [role="textbox"]').first();
  let boxVisible = await textbox
    .isVisible({ timeout: 1500 })
    .catch(() => false);

  if (!boxVisible) {
    const addNote = dialog
      .getByRole("button", { name: /add (a |free )?note/i })
      .first();
    if (!(await addNote.isVisible({ timeout: 1500 }).catch(() => false))) {
      return { ok: false, reason: "no textbox and no 'Add a note' button" };
    }
    await addNote.click({ timeout: ACTION_TIMEOUT_MS }).catch(() => {});
    await sleep(700);

    // Free-note quota exhausted? LinkedIn replaces the textbox dialog
    // with a Premium upsell. Detect, close, and signal to the caller.
    if (await dismissPremiumUpsellIfPresent(page)) {
      return {
        ok: false,
        reason: "free custom-note quota exhausted",
        hitFreeNoteLimit: true,
      };
    }

    textbox = dialog.locator('textarea, [role="textbox"]').first();
    boxVisible = await textbox
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!boxVisible) {
      // Last-chance Premium check (in case the upsell came up late).
      if (await dismissPremiumUpsellIfPresent(page)) {
        return {
          ok: false,
          reason: "free custom-note quota exhausted",
          hitFreeNoteLimit: true,
        };
      }
      return {
        ok: false,
        reason: "clicked 'Add a note' but textbox never appeared",
      };
    }
  }

  // Explicit focus before typing — LinkedIn doesn't always transfer focus
  // automatically after the dialog state change.
  await textbox.click({ timeout: ACTION_TIMEOUT_MS }).catch(() => {});
  await textbox.focus().catch(() => {});
  await sleep(150);

  // pressSequentially focuses the locator and types one key at a time;
  // it's more reliable than page.keyboard.type which depends on the
  // currently-focused element.
  try {
    await textbox.pressSequentially(trimmed, { delay: 80 });
  } catch (err) {
    return {
      ok: false,
      reason: `pressSequentially failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Verify the textbox actually received the text — if it didn't, the
  // Send button will stay disabled and we'll spin forever.
  const value = await textbox
    .evaluate((el) => {
      const node = el as HTMLTextAreaElement | HTMLElement;
      if ("value" in node) return (node as HTMLTextAreaElement).value;
      return (node.textContent ?? "").trim();
    })
    .catch(() => "");
  if (!value || value.trim().length === 0) {
    return { ok: false, reason: "typed into textbox but it remained empty" };
  }
  return { ok: true, reason: `typed ${value.length} chars` };
}

// Click the right "Send" variant in the invitation dialog. Tries the
// most-likely labels per branch (note-attached vs note-skipped), filters
// out disabled buttons (LinkedIn keeps Send disabled until the textbox
// has text), and falls back to a fuzzy text scan. On total failure,
// returns a dump of every button in the dialog so the caller can show
// the user what's actually there.
async function clickSendInDialog(
  dialog: Locator,
  hasNote: boolean,
): Promise<{ clicked: boolean; diagnostic: string }> {
  const primaryLabels = hasNote
    ? [/^Send invitation$/i, /^Send now$/i, /^Send$/i]
    : [/^Send without (a )?note$/i, /^Skip$/i, /^Send$/i, /^Send now$/i];

  for (const label of primaryLabels) {
    const btn = dialog.getByRole("button", { name: label }).first();
    if (!(await btn.isVisible({ timeout: 1500 }).catch(() => false))) continue;
    const enabled = await btn.isEnabled().catch(() => true);
    if (!enabled) continue;
    try {
      await btn.click({ timeout: ACTION_TIMEOUT_MS });
      return { clicked: true, diagnostic: `${label} (role match)` };
    } catch {
      continue;
    }
  }

  // Fuzzy fallback: any enabled button in the dialog whose visible text
  // starts with "Send" or is "Skip". Excludes Cancel, Close, Back.
  const fuzzyHandle = await dialog
    .evaluate((el) => {
      const buttons = Array.from(
        el.querySelectorAll('button, [role="button"]'),
      ) as HTMLElement[];
      const out: Array<{ idx: number; text: string; aria: string; disabled: boolean }> = [];
      buttons.forEach((b, idx) => {
        const aria = (b.getAttribute("aria-label") ?? "").trim();
        const text = (b.textContent ?? "").replace(/\s+/g, " ").trim();
        const disabled =
          (b as HTMLButtonElement).disabled ||
          b.getAttribute("aria-disabled") === "true";
        out.push({ idx, text, aria, disabled });
        if (disabled) return;
        const t = text.toLowerCase();
        if (
          (t.startsWith("send") || t === "skip") &&
          !["cancel", "close", "back"].some((x) => t.includes(x))
        ) {
          b.setAttribute("data-bpo-send-target", "1");
        }
      });
      return out;
    })
    .catch(() => [] as Array<{ idx: number; text: string; aria: string; disabled: boolean }>);

  const target = dialog.locator('[data-bpo-send-target="1"]').first();
  if (await target.isVisible({ timeout: 500 }).catch(() => false)) {
    try {
      await target.click({ timeout: ACTION_TIMEOUT_MS });
      return { clicked: true, diagnostic: "fuzzy text match (Send/Skip)" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        clicked: false,
        diagnostic: `fuzzy target click failed: ${msg}. Dialog buttons: ${summarizeButtons(fuzzyHandle)}`,
      };
    }
  }

  return {
    clicked: false,
    diagnostic: `no Send-like button found. Dialog buttons: ${summarizeButtons(fuzzyHandle)}`,
  };
}

function summarizeButtons(
  buttons: Array<{ text: string; aria: string; disabled: boolean }>,
): string {
  if (buttons.length === 0) return "(no buttons in dialog)";
  return buttons
    .map(
      (b) =>
        `[${b.disabled ? "X" : "+"}] "${b.text.slice(0, 30)}"${b.aria ? ` aria="${b.aria.slice(0, 30)}"` : ""}`,
    )
    .join(" | ");
}

// Cleanly restart the Connect flow and return a freshly opened invitation
// dialog so the caller can send WITHOUT a note. Used by the no-note
// fallback after a note attempt hit LinkedIn's Premium upsell.
//
// We RELOAD the profile first. Clicking "Add a note" → dismissing the
// upsell → immediately re-clicking Connect pollutes LinkedIn's invitation
// state and makes the next send fail with "invitation not sent, please try
// again". A reload gives a clean slate and clears that conflict.
//
// Returns:
//   - { status: "pending" } if the earlier attempt actually registered
//     (top card already shows Pending) — caller should treat as success.
//   - { status: "dialog", dialog } with the fresh invitation dialog.
//   - { status: "error", error } if Connect/dialog couldn't be reopened.
async function reopenConnectDialog(
  page: Page,
  firstName?: string,
): Promise<
  | { status: "dialog"; dialog: Locator }
  | { status: "pending" }
  | { status: "error"; error: string }
> {
  // Close any lingering modal, then reload for a clean slate.
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(300);
  try {
    await page.reload({
      waitUntil: "domcontentloaded",
      timeout: PROFILE_LOAD_TIMEOUT_MS,
    });
  } catch {
    /* fall through — we'll still try to find Connect below */
  }
  await sleep(2500);

  // The earlier (note) attempt may actually have registered the invite.
  if (await isPendingShown(page)) {
    console.log(
      "[playwright] no-note fallback: profile already shows Pending after reload — invite landed",
    );
    return { status: "pending" };
  }

  const retry = await findAndMarkConnectButton(page, firstName);
  console.log(
    `[playwright] no-note fallback Connect re-search: found=${retry.found} via=${retry.via ?? "n/a"}`,
  );
  if (!retry.found) {
    const screenshot = await saveDebugScreenshot(page, "fallback-no-connect");
    return {
      status: "error",
      error: `Note couldn't be attached and the Connect button couldn't be re-found to retry without a note. Screenshot: ${screenshot}`,
    };
  }
  try {
    await page
      .locator(`[${CONNECT_MARKER_ATTR}="1"]`)
      .first()
      .click({ timeout: ACTION_TIMEOUT_MS });
  } catch (err) {
    const screenshot = await saveDebugScreenshot(
      page,
      "fallback-connect-click-failed",
    );
    return {
      status: "error",
      error: `No-note fallback: retry-Connect click failed: ${err instanceof Error ? err.message : String(err)}. Screenshot: ${screenshot}`,
    };
  }
  await sleep(1200);
  const retryDialog = page.locator('[role="dialog"]').first();
  const open = await retryDialog
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  if (!open) {
    const screenshot = await saveDebugScreenshot(page, "fallback-no-dialog");
    return {
      status: "error",
      error: `No-note fallback: retry-Connect didn't reopen the invitation dialog. Screenshot: ${screenshot}`,
    };
  }
  await saveDebugScreenshot(page, "fallback-invite-dialog");
  return { status: "dialog", dialog: retryDialog };
}

// True when the profile's top card shows a "Pending" button — the
// ground-truth signal that an invitation was actually queued by LinkedIn.
async function isPendingShown(page: Page): Promise<boolean> {
  const scope = profileScope(page);
  const pending = scope.getByRole("button", { name: /^Pending/i }).first();
  return pending.isVisible({ timeout: 1000 }).catch(() => false);
}

// LinkedIn dismisses the invitation dialog and THEN surfaces an error toast
// ("Sorry, invitation not sent to … Please try again.") when a send is
// rejected (per-profile/weekly limits, soft blocks). Returns the toast text
// if such a failure toast is present.
async function detectSendErrorToast(page: Page): Promise<string | null> {
  const toast = page
    .locator('[role="alert"], .artdeco-toast-item, [class*="artdeco-toast"]')
    .filter({
      hasText:
        /not sent|couldn'?t send|unable to send|please try again|something went wrong/i,
    })
    .first();
  if (!(await toast.isVisible({ timeout: 1500 }).catch(() => false))) {
    return null;
  }
  const txt = ((await toast.textContent().catch(() => "")) ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return txt || "LinkedIn reported the invitation was not sent.";
}

async function findActionButtons(page: Page): Promise<ActionAreaButtons> {
  // Scope to the profile's own action area so we don't pick up Connect /
  // Message / Follow buttons that belong to OTHER people in the "More
  // profiles for you" sidebar.
  const scope = profileScope(page);
  const result: ActionAreaButtons = {};

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
      let lastDiag: FindConnectResult | null = null;
      const direct = await findAndMarkConnectButton(page, input.firstName);
      lastDiag = direct;
      console.log(
        `[playwright] Connect search: found=${direct.found} via=${direct.via ?? "n/a"} candidates=${direct.candidates.length}`,
      );
      if (direct.candidates.length > 0) {
        console.log(
          `[playwright] candidates: ${direct.candidates
            .map(
              (c) =>
                `${c.reason}${c.inSidebar ? "(sidebar)" : ""}: aria="${c.ariaLabel}" text="${c.text}"`,
            )
            .join(" || ")}`,
        );
      }
      if (direct.found) {
        try {
          await page
            .locator(`[${CONNECT_MARKER_ATTR}="1"]`)
            .first()
            .click({ timeout: ACTION_TIMEOUT_MS });
          clicked = true;
        } catch (err) {
          await saveDebugScreenshot(page, "connect-click-failed");
          console.error(
            `[playwright] marked Connect button click failed:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
      if (!clicked && buttons.moreActions) {
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
        const candidateSummary =
          lastDiag && lastDiag.candidates.length > 0
            ? lastDiag.candidates
                .map(
                  (c) =>
                    `${c.tag}[${c.reason}]${c.inSidebar ? " (sidebar)" : ""}: aria="${c.ariaLabel.slice(0, 40)}" text="${c.text.slice(0, 40)}"`,
                )
                .join(" | ")
            : "no Connect-like buttons matched on the page";
        return {
          success: false,
          provider: this.provider,
          error: `Couldn't find a Connect option for this profile. Diagnostic: ${candidateSummary}. Screenshot: ${screenshot ?? "(capture failed)"}`,
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

      // Two dialog variants LinkedIn shows after Connect:
      //   A) "Add a note to your invitation?" with [Add a note] [Send without a note]
      //   B) After clicking Add a note: textarea + [Cancel] [Send] (Send disabled
      //      until the textbox has text)
      // We branch on whether we have a non-empty note to send.
      const noteText = (input.note ?? "").trim();
      const hasNote = noteText.length > 0;

      let noteAttached = false;
      let noteFailReason = "";
      // Did we click "Add a note"? If so the dialog/invitation state is
      // polluted and must be reopened fresh; if not (skip path), the
      // first dialog is still clean and we can send without a note there.
      let dialogClobbered = false;
      if (hasNote && freeNoteQuotaExhausted) {
        // We already learned this account is out of free notes — don't
        // bother clicking "Add a note" (it just triggers the Premium
        // upsell and forces a fragile reopen). Fall straight through to
        // "Send without a note" on the dialog that's already open.
        noteFailReason = "free custom-note quota known-exhausted this session";
        console.log(
          "[playwright] skipping note attach (quota known-exhausted); sending without a note",
        );
      } else if (hasNote) {
        const filled = await fillInvitationNote(page, dialog, noteText);
        noteAttached = filled.ok;
        noteFailReason = filled.reason;
        dialogClobbered = !filled.ok; // we interacted with Add-a-note / upsell
        if (filled.hitFreeNoteLimit) {
          freeNoteQuotaExhausted = true;
        }
        if (!filled.ok) {
          console.warn(
            `[playwright] note fill failed (${filled.reason}); ${
              filled.hitFreeNoteLimit
                ? "free note quota exhausted — "
                : ""
            }falling back to connect without a note`,
          );
        }
      }

      // No-note fallback. If we meant to attach a note but couldn't —
      // most commonly because this is a free account whose custom-note
      // quota is exhausted (LinkedIn shows a Premium upsell) — we still
      // connect, just without a note. Two sub-cases:
      //   A) we never clicked "Add a note" (quota known-exhausted skip
      //      path) → the first dialog is clean → send "without a note" here.
      //   B) we clicked "Add a note" and hit the upsell → the dialog is
      //      polluted → reopen Connect fresh (with a reload) and send
      //      without a note via reopenConnectDialog().
      let activeDialog = dialog;
      let activeHasNote = noteAttached;
      if (hasNote && !noteAttached) {
        // Clear any lingering Premium upsell so it doesn't intercept clicks.
        await dismissPremiumUpsellIfPresent(page);

        if (!dialogClobbered) {
          // Case A — reuse the still-clean first dialog.
          console.log(
            "[playwright] no-note fallback: reusing clean first dialog; sending without a note",
          );
          activeDialog = dialog;
          activeHasNote = false;
        } else {
          // Case B — reopen the Connect flow from a clean reload.
          const reopened = await reopenConnectDialog(page, input.firstName);
          if (reopened.status === "pending") {
            // The note attempt actually registered the invite.
            return {
              success: true,
              externalId: uid("pw-conn"),
              provider: this.provider,
            };
          }
          if (reopened.status === "error") {
            return {
              success: false,
              provider: this.provider,
              error: `${reopened.error} (original note failure: ${noteFailReason})`,
            };
          }
          activeDialog = reopened.dialog;
          activeHasNote = false;
        }
      }

      const sendResult = await clickSendInDialog(activeDialog, activeHasNote);
      if (!sendResult.clicked) {
        const screenshot = await saveDebugScreenshot(page, "no-send-in-dialog");
        return {
          success: false,
          provider: this.provider,
          error: `Invitation dialog opened but no Send button could be clicked. Dialog buttons: ${sendResult.diagnostic}. Screenshot: ${screenshot}`,
        };
      }
      console.log(
        `[playwright] Send clicked via: ${sendResult.diagnostic}${
          hasNote && !activeHasNote ? " (no-note fallback)" : ""
        }`,
      );

      // The dialog dismissing is LinkedIn's confirmation that the invite
      // was queued. If the dialog stays open, the request did NOT go
      // through (e.g. weekly limit reached, error toast inside dialog).
      const dismissed = await activeDialog
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

      // Ground truth (rule #9): the dialog dismissing is NOT proof the
      // invite was sent. LinkedIn dismisses the dialog and THEN shows an
      // error toast ("Sorry, invitation not sent … Please try again.")
      // while leaving the top card on "Connect". So we (a) look for that
      // failure toast and (b) confirm the top card actually flipped to
      // "Pending" before claiming success.
      const errToast = await detectSendErrorToast(page);
      if (errToast) {
        const screenshot = await saveDebugScreenshot(page, "send-error-toast");
        return {
          success: false,
          provider: this.provider,
          error: `LinkedIn rejected the invitation: "${errToast}" — the request was NOT sent. This is usually a per-profile or weekly invitation limit. Screenshot: ${screenshot}`,
        };
      }

      // Poll for "Pending" in place; if it doesn't show, reload the profile
      // once (most reliable signal) and re-check.
      let pending = false;
      for (let i = 0; i < 4 && !pending; i++) {
        pending = await isPendingShown(page);
        if (!pending) await sleep(700);
      }
      if (!pending) {
        await page
          .reload({
            waitUntil: "domcontentloaded",
            timeout: PROFILE_LOAD_TIMEOUT_MS,
          })
          .catch(() => {});
        await sleep(2500);
        for (let i = 0; i < 3 && !pending; i++) {
          pending = await isPendingShown(page);
          if (!pending) await sleep(800);
        }
      }
      if (!pending) {
        const screenshot = await saveDebugScreenshot(page, "send-unverified");
        return {
          success: false,
          provider: this.provider,
          error: `Clicked Send and the dialog closed, but the profile never showed "Pending" — the connection request was NOT actually sent (LinkedIn may have silently blocked it or only dismissed a Premium upsell). Screenshot: ${screenshot}`,
        };
      }

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
