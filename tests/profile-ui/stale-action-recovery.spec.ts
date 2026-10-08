import { expect, test } from "@playwright/test";

test("an unrecognised action reloads the same URL once, without replaying the mutation", async ({
  page,
}) => {
  let posts = 0;
  let documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.resourceType() === "document")
      documents++;
  });
  await page.route("**/login**", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      posts++;
      await route.fulfill({
        status: 404,
        headers: { "x-nextjs-action-not-found": "1" },
        body: "Action not found",
      });
    } else await route.continue();
  });
  await page.goto("/login?next=%2Fbookings");
  const submit = async () => {
    await page.getByLabel("Email", { exact: true }).fill("stale-action@example.invalid");
    await page.getByLabel("Password", { exact: true }).fill("synthetic-never-sent");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
  };
  await submit();
  await expect.poll(() => documents).toBe(2);
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login\?next=%2Fbookings$/);
  expect(posts).toBe(1);
  await submit();
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  expect(posts).toBe(2);
  expect(documents).toBe(2);
});
