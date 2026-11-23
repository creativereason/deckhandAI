import { expect, test, type Page } from "@playwright/test";

const BOARD_LIST = { layout: "list", hiddenStatuses: ["declined"] };
const BOARD_PIPELINE = { layout: "pipeline", hiddenStatuses: ["declined"] };

async function useStorage(page: Page, items: Record<string, string>) {
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, { "assistant-open": "false", ...items });
}

test.describe("login", () => {
  test("shows an error when the password is wrong", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect password")).toBeVisible();
  });

  test("opens the password help dialog", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("dialog")).toContainText("APP_PASSWORD");
  });
});

test.describe("navigation", () => {
  test("moves between Board, Inbox and Today", async ({ page }) => {
    await useStorage(page, {});
    await page.goto("/");
    await page.getByRole("link", { name: /Inbox/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
    await page.getByRole("link", { name: /^Today$/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await page.getByRole("link", { name: /^Board$/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Board" })).toBeVisible();
  });

  test("every settings and tool page renders exactly one h1", async ({ page }) => {
    await useStorage(page, {});
    for (const path of ["/settings", "/settings/scraping", "/settings/scrape-targets", "/settings/profile-ai", "/settings/model", "/settings/export", "/settings/agents", "/scrape-sources", "/styleguide", "/login"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
  });
});

test.describe("board", () => {
  test("pipeline layout shows a column for each stage", async ({ page }) => {
    await useStorage(page, { "board-filters": JSON.stringify(BOARD_PIPELINE) });
    await page.goto("/");
    for (const column of ["Prospects", "Applied", "Screening", "Interview", "Offer"]) {
      await expect(page.getByRole("region", { name: column })).toBeVisible();
    }
  });

  test("switching from list to pipeline layout shows the columns", async ({ page }) => {
    await useStorage(page, { "board-filters": JSON.stringify(BOARD_LIST) });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Applied" })).toBeVisible();
    await page.getByRole("radio", { name: "Pipeline" }).click();
    await expect(page.getByRole("region", { name: "Prospects" })).toBeVisible();
  });

  test("search narrows the board to matching companies", async ({ page }) => {
    await useStorage(page, { "board-filters": JSON.stringify(BOARD_LIST) });
    await page.goto("/");
    await page.getByLabel("Search jobs").fill("Stripe");
    await expect(page.getByText("Stripe").first()).toBeVisible();
    await expect(page.getByText("Anthropic")).toHaveCount(0);
  });
});

test.describe("triage", () => {
  test("skipping with S keeps the reviewed count and shows the triage actions", async ({ page }) => {
    await useStorage(page, {});
    await page.goto("/?view=inbox");
    await expect(page.getByText(/Reviewed 0 of/)).toBeVisible();
    await page.keyboard.press("s");
    await expect(page.getByText(/Reviewed 0 of/)).toBeVisible();
    for (const name of [/^Pass/, /^Skip/]) {
      await expect(page.getByRole("button", { name }).first()).toBeVisible();
    }
  });
});

test.describe("job detail", () => {
  test("opens the edit form and cancels it", async ({ page }) => {
    await useStorage(page, {});
    await page.goto("/job?section=applied&company=Stripe&role=Creative%20Director%2C%20Brand%20Experiences");
    await expect(page.getByRole("heading", { level: 1, name: "Stripe" })).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Company", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Cancel edit" }).click();
    await expect(page.getByLabel("Company", { exact: true })).toHaveCount(0);
  });
});

test.describe("assistant", () => {
  test("opens and hides the Deckhand panel", async ({ page }) => {
    await useStorage(page, { "assistant-open": "true" });
    await page.goto("/");
    const panel = page.getByRole("complementary", { name: "Deckhand assistant" });
    await expect(panel).toBeVisible();
    await expect(page.getByPlaceholder("Message…")).toBeVisible();
    await page.getByRole("button", { name: "Hide Deckhand" }).click();
    await expect(panel).toBeHidden();
  });
});

test.describe("settings", () => {
  test("pressing Enter in Target titles starts a new title on a new line", async ({ page }) => {
    await useStorage(page, {});
    await page.goto("/settings");
    const titles = page.getByLabel("Target titles");
    await titles.fill("Head of Design");
    await titles.press("Enter");
    await titles.pressSequentially("VP Design");
    await expect(titles).toHaveValue("Head of Design\nVP Design");
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows the bottom navigation and no horizontal overflow", async ({ page }) => {
    await useStorage(page, {});
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    for (const path of ["/", "/?view=today", "/?view=inbox", "/settings"]) {
      await page.goto(path);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, path).toBeLessThanOrEqual(390);
    }
  });
});
