// Runs the redesign smoke workflows against the demo-mode dev server.
// Usage: node redesign/tools/workflows.mjs   (server must already be running on BASE)
import { chromium } from "playwright";

const BASE = "http://localhost:3789";
const TIMEOUT = 5000;
const SLOW_TIMEOUT = 15000;
const JOB_PATH =
  "/job?section=applied&company=Stripe&role=Creative%20Director%2C%20Brand%20Experiences";
const BOARD_PIPELINE = { layout: "pipeline", hiddenStatuses: ["declined"] };
const BOARD_LIST = { layout: "list", hiddenStatuses: ["declined"] };

class Fail extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(condition, reason) {
  if (!condition) throw new Fail(reason);
}

async function countVisible(locator) {
  const total = await locator.count();
  let visible = 0;
  for (let i = 0; i < total; i++) {
    if (await locator.nth(i).isVisible()) visible++;
  }
  return visible;
}

async function eventually(predicate, timeout = TIMEOUT) {
  const deadline = Date.now() + timeout;
  while (Date.now() <= deadline) {
    if (await predicate()) return true;
    await sleep(150);
  }
  return false;
}

async function shows(locator, what, timeout = TIMEOUT) {
  const ok = await eventually(async () => (await countVisible(locator)) > 0, timeout);
  if (!ok) throw new Fail(`${what} not visible`);
}

async function hidden(locator, what) {
  const ok = await eventually(async () => (await countVisible(locator)) === 0);
  if (!ok) throw new Fail(`${what} still visible`);
}

async function clickVisible(locator, what) {
  let target;
  const found = await eventually(async () => {
    const total = await locator.count();
    for (let i = 0; i < total; i++) {
      if (await locator.nth(i).isVisible()) {
        target = locator.nth(i);
        return true;
      }
    }
    return false;
  });
  if (!found) throw new Fail(`${what} not clickable (no visible match)`);
  await target.click();
}

async function openSession(browser, { storage = {}, width = 1280, height = 800 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(
    (items) => {
      for (const [key, value] of Object.entries(items)) {
        localStorage.setItem(key, value);
      }
    },
    { "assistant-open": "false", ...storage },
  );
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  return { context, page, pageErrors, consoleErrors };
}

async function goto(session, path) {
  await session.page.goto(`${BASE}${path}`, { waitUntil: "load" });
}

function heading(page, name, level) {
  return page.getByRole("heading", { level, name, exact: true });
}

const workflows = [
  {
    name: "board-pipeline",
    options: { storage: { "board-filters": JSON.stringify(BOARD_PIPELINE) } },
    async run({ page }) {
      await goto({ page }, "/");
      for (const column of ["Prospects", "Applied", "Screening", "Interview", "Offer"]) {
        await shows(page.getByRole("region", { name: column }), `region ${column}`);
      }
      await shows(page.getByLabel("Move Anthropic to"), "'Move Anthropic to' select");
    },
  },
  {
    name: "board-list",
    options: { storage: { "board-filters": JSON.stringify(BOARD_LIST) } },
    async run({ page }) {
      await goto({ page }, "/");
      await shows(page.getByRole("heading", { name: "Applied" }), "heading Applied");
      await shows(page.getByRole("heading", { name: "Prospects" }), "heading Prospects");
      await clickVisible(page.getByRole("radio", { name: "Pipeline" }), "Pipeline radio");
      await shows(page.getByRole("region", { name: "Prospects" }), "region Prospects after switch");
    },
  },
  {
    name: "search",
    async run({ page }) {
      await goto({ page }, "/");
      await page.getByLabel("Search jobs").fill("Stripe");
      await shows(page.getByText("Stripe"), "Stripe");
      await hidden(page.getByText("Anthropic"), "Anthropic");
    },
  },
  {
    name: "nav",
    async run({ page }) {
      await goto({ page }, "/");
      await clickVisible(page.getByRole("link", { name: /Inbox/ }), "Inbox link");
      await shows(heading(page, "Inbox", 1), "h1 Inbox");
      await clickVisible(page.getByRole("link", { name: /^Today$/ }), "Today link");
      await shows(heading(page, "Today", 1), "h1 Today");
      await clickVisible(page.getByRole("link", { name: /^Board$/ }), "Board link");
      await shows(heading(page, "Board", 1), "h1 Board");
    },
  },
  {
    name: "triage",
    async run({ page }) {
      await goto({ page }, "/?view=inbox");
      await shows(page.getByText(/Reviewed 0 of/), "progress text 'Reviewed 0 of'");
      await page.keyboard.press("s");
      await sleep(300);
      await shows(page.getByText(/Reviewed 0 of/), "progress text still 'Reviewed 0 of' after skip");
      for (const label of [/^Pass/, /^Skip/, /^Keep/]) {
        await shows(page.getByRole("button", { name: label }), `button ${label}`);
      }
    },
  },
  {
    name: "job-detail",
    async run({ page }) {
      await goto({ page }, JOB_PATH);
      await shows(heading(page, "Stripe", 1), "h1 Stripe");
      await clickVisible(page.getByRole("button", { name: "Edit", exact: true }), "Edit button");
      await shows(page.getByLabel("Company", { exact: true }), "Company textbox");
      await clickVisible(page.getByRole("button", { name: "Cancel edit" }), "Cancel edit button");
    },
  },
  {
    name: "assistant",
    options: { storage: { "assistant-open": "true" } },
    async run({ page }) {
      await goto({ page }, "/");
      const panel = page.getByRole("complementary", { name: "Deckhand assistant" });
      await shows(panel, "aside 'Deckhand assistant'");
      await shows(page.getByPlaceholder("Message…"), "Message textbox");
      await clickVisible(page.getByRole("button", { name: "Hide Deckhand" }), "Hide Deckhand button");
      await hidden(panel, "assistant panel after hiding");
    },
  },
  {
    name: "ask-from-card",
    options: { storage: { "board-filters": JSON.stringify(BOARD_PIPELINE) } },
    async run({ page }) {
      await goto({ page }, "/");
      await clickVisible(
        page.getByRole("button", { name: "Ask Deckhand about Anthropic" }),
        "'Ask Deckhand about Anthropic' button",
      );
      const panel = page
        .getByRole("complementary", { name: "Deckhand assistant" })
        .or(page.getByRole("dialog"));
      await shows(panel, "assistant panel");
      await shows(panel.getByText(/Anthropic/), "user message containing Anthropic");
    },
  },
  {
    name: "settings",
    async run(session) {
      const paths = [
        "/settings",
        "/settings/scraping",
        "/settings/scrape-targets",
        "/settings/profile-ai",
        "/settings/model",
        "/settings/export",
        "/settings/agents",
        "/scrape-sources",
        "/styleguide",
        "/login",
      ];
      for (const path of paths) {
        await goto(session, path);
        await shows(session.page.getByRole("heading", { level: 1 }), `h1 on ${path}`, SLOW_TIMEOUT);
        const count = await session.page.getByRole("heading", { level: 1 }).count();
        check(count === 1, `${path} has ${count} visible-or-not h1 elements, expected 1`);
        if (session.pageErrors.length) {
          throw new Fail(`pageerror on ${path}: ${session.pageErrors.join(" | ")}`);
        }
      }
    },
  },
  {
    name: "mobile",
    options: { width: 390, height: 844 },
    async run({ page }) {
      await goto({ page }, "/");
      await shows(page.getByRole("navigation", { name: "Primary" }), "bottom nav 'Primary'");
      for (const path of ["/", "/?view=today", "/?view=inbox", "/settings", JOB_PATH]) {
        await goto({ page }, path);
        await sleep(500);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        check(scrollWidth <= 390, `${path} scrollWidth ${scrollWidth} > 390`);
      }
    },
  },
];

async function launchChrome() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await chromium.launch({ channel: "chrome" });
    } catch (error) {
      lastError = error;
      console.error(`launch attempt ${attempt} failed: ${error.message.split("\n")[0]}`);
    }
  }
  throw lastError;
}

function reasonFor(error) {
  if (error instanceof Fail) return error.message;
  return `${error.name}: ${error.message.split("\n")[0]}`;
}

async function runWorkflow(browser, workflow) {
  const session = await openSession(browser, workflow.options);
  const reasons = [];
  try {
    await workflow.run(session);
  } catch (error) {
    reasons.push(reasonFor(error));
  } finally {
    await session.context.close().catch(() => {});
  }
  if (session.pageErrors.length) {
    reasons.push(`pageerror: ${session.pageErrors.join(" | ")}`);
  }
  return { name: workflow.name, reasons, consoleErrorCount: session.consoleErrors.length };
}

async function main() {
  const browser = await launchChrome();
  const results = [];
  try {
    for (const workflow of workflows) {
      results.push(await runWorkflow(browser, workflow));
    }
  } finally {
    await browser.close().catch(() => {});
  }
  for (const result of results) {
    if (result.reasons.length === 0) {
      console.log(`PASS ${result.name}`);
    } else {
      console.log(`FAIL ${result.name}: ${result.reasons.join("; ")}`);
    }
  }
  const totalConsole = results.reduce((sum, result) => sum + result.consoleErrorCount, 0);
  console.log(`console errors (not failing): ${totalConsole}`);
}

main().catch((error) => {
  console.error(`run aborted: ${error.message.split("\n")[0]}`);
  process.exitCode = 1;
});
