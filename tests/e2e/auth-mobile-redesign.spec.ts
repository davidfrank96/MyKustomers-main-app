import fs from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "./support/test";

const requiredViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;
const screenshotDirectory = path.resolve("test-results/mobile-auth");

async function expectNoOverflow(page: Page, route: string, width: number) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth, `${route} overflowed at ${width}px`).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

async function expectWhitePrimaryControl(control: Locator) {
  await expect(control).toBeVisible();
  expect(await control.evaluate((element) => getComputedStyle(element).color)).toBe(
    "rgb(255, 255, 255)",
  );
}

async function expectPasswordToggle(
  page: Page,
  fieldLabel: string,
  showLabel: string,
  hideLabel: string,
) {
  const field = page.getByLabel(fieldLabel, { exact: true });
  await expect(field).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: showLabel }).click();
  await expect(field).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: hideLabel }).click();
  await expect(field).toHaveAttribute("type", "password");
}

test("login and signup match the approved mobile auth hierarchy", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "One browser covers the visual matrix.",
  );
  test.setTimeout(90_000);

  for (const viewport of requiredViewports) {
    const { width } = viewport;
    await page.setViewportSize(viewport);

    await page.goto("/login?message=signed-out");
    await expect(page.getByRole("link", { name: "MyKustomers.com home" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByText("Access your My Kustomers workspace.")).toBeVisible();
    await expect(page.getByText("You have been signed out.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.getByText("or continue with email")).toBeVisible();
    await expectPasswordToggle(page, "Password", "Show password", "Hide password");
    await expectWhitePrimaryControl(page.getByRole("button", { name: "Log in" }));
    await expect(page.getByRole("link", { name: "Forgot your password?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
    await expectNoOverflow(page, "/login", width);

    await page.goto("/signup");
    await expect(page.getByRole("link", { name: "MyKustomers.com home" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Create your My Kustomers login. You will set up your business next.",
      ),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Enter your full name")).toBeVisible();
    await expect(page.getByPlaceholder("Enter your email address")).toBeVisible();
    await expectPasswordToggle(page, "Password", "Show password", "Hide password");
    await expectPasswordToggle(
      page,
      "Confirm password",
      "Show confirm password",
      "Hide confirm password",
    );
    await expectWhitePrimaryControl(page.getByRole("button", { name: "Create account" }));
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expectNoOverflow(page, "/signup", width);
  }

  fs.mkdirSync(screenshotDirectory, { recursive: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login?message=signed-out");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDirectory, `login-${width}.png`),
      fullPage: true,
    });

    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDirectory, `signup-${width}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto("/signup");
  const createAccount = page.getByRole("button", { name: "Create account" });
  await createAccount.scrollIntoViewIfNeeded();
  await expect(createAccount).toBeVisible();
  await expectNoOverflow(page, "/signup keyboard viewport", 320);
});
