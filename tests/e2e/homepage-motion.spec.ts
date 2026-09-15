import { expect, test } from "./support/test";

const hero = '[data-homepage-motion="hero"]';
const loyalty = '[data-homepage-motion="loyalty"]';

test("mobile never shows three signals, including every crossfade boundary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#features");
  await expect(page.locator(hero)).toHaveAttribute("data-motion-running", "true");
  const result = await page.locator(hero).evaluate((region) => {
    const cards = Array.from(region.querySelectorAll<HTMLElement>("[data-hero-signal]"));
    const cycles: Animation[] = [];
    for (const card of cards)
      for (const animation of card.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = 3000;
        if ((animation as CSSAnimation).animationName.includes("cycle-"))
          cycles.push(animation);
      }
    const pairs = new Set<string>();
    let maxVisible = 0;
    for (let ms = 0; ms <= 18000; ms += 75) {
      cycles.forEach((animation) => {
        animation.currentTime = ms;
      });
      const shown = cards.filter(
        (card) => Number(getComputedStyle(card.firstElementChild!).opacity) > 0.001,
      );
      maxVisible = Math.max(maxVisible, shown.length);
      pairs.add(
        shown
          .map((card) => card.dataset.heroSignal)
          .sort()
          .join("+"),
      );
    }
    return { maxVisible, pairs: [...pairs], cycles: cycles.length };
  });
  expect(result.cycles).toBe(3);
  expect(result.maxVisible).toBe(2);
  expect(result.pairs).toEqual(
    expect.arrayContaining([
      "confirmation+reaction",
      "delivery+reaction",
      "confirmation+delivery",
    ]),
  );
});

test("new CSS loops and SVG pulse pause offscreen without resetting their first entrance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#features");
  await expect(page.locator(hero)).toHaveAttribute("data-motion-running", "true");
  await page.locator(loyalty).scrollIntoViewIfNeeded();
  await expect(page.locator(hero)).toHaveAttribute("data-motion-running", "false");
  await expect(page.locator(loyalty)).toHaveAttribute("data-motion-running", "true");
  const heroAnimations = await page
    .locator(`${hero} [data-hero-signal]`)
    .first()
    .evaluate((card) =>
      card.getAnimations({ subtree: true }).map((animation) => animation.playState),
    );
  expect(heroAnimations.length).toBeGreaterThan(0);
  expect(heroAnimations.every((state) => state === "paused")).toBe(true);
  expect(
    await page
      .locator(`${loyalty} [data-motion-wire="mobile"]`)
      .evaluate((svg) => (svg as SVGSVGElement).animationsPaused()),
  ).toBe(false);
  expect(
    await page
      .locator(`${loyalty} [data-motion-wire="desktop"]`)
      .evaluate((svg) => (svg as SVGSVGElement).animationsPaused()),
  ).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator(loyalty)).toHaveAttribute("data-motion-running", "false");
  const wire = page.locator(`${loyalty} [data-motion-wire="mobile"]`);
  const time = await wire.evaluate((svg) => (svg as SVGSVGElement).getCurrentTime());
  await page.waitForTimeout(250);
  expect(
    await wire.evaluate((svg) => (svg as SVGSVGElement).getCurrentTime()),
  ).toBeCloseTo(time, 2);
  await expect(page.locator(loyalty)).toHaveAttribute("data-motion-entered", "true");
});

test("reduced motion reveals a complete static story, including a preference change during playback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const region of await page.locator("[data-homepage-motion]").all())
    await expect(region).toHaveAttribute("data-motion-static", "true");
  await expect(page.getByTestId("demo-insights")).toContainText(
    "Bookings up 18% vs last week",
  );
  await expect(page.locator(`${loyalty} li`)).toHaveCount(3);
  for (const card of await page.locator(`${loyalty} li`).all())
    await expect(card).toHaveCSS("opacity", "1");
  const motion = await page.locator(loyalty).evaluate((region) => ({
    animations: region.getAnimations({ subtree: true }).length,
    wires: [...region.querySelectorAll<SVGSVGElement>("[data-motion-wire]")].every(
      (svg) => svg.animationsPaused(),
    ),
    paths: [...region.querySelectorAll("[data-motion-wire] > path")].map(
      (path) => getComputedStyle(path).strokeDashoffset,
    ),
  }));
  expect(motion).toEqual({ animations: 0, wires: true, paths: ["0px", "0px"] });
  await expect(page.getByRole("button", { name: "Pause supporting motion" })).toHaveCount(
    0,
  );
});

test("supporting motion is keyboard pausable and does not add live announcements or focusable signals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const pause = page.getByRole("button", { name: "Pause supporting motion" });
  await pause.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Resume supporting motion" }),
  ).toBeFocused();
  await expect(page.locator(hero)).toHaveAttribute("data-motion-static", "true");
  await expect(page.locator(loyalty)).toHaveAttribute("data-motion-static", "true");
  await expect(
    page.locator(
      `${loyalty} [aria-live], [data-hero-signal] [aria-live], [data-hero-signal] a, [data-hero-signal] button, [data-hero-signal] [tabindex]`,
    ),
  ).toHaveCount(0);
  const story = page.getByRole("list", {
    name: "From a confirmed booking to customer feedback",
  });
  await expect(story).toMatchAriaSnapshot(`
    - list "From a confirmed booking to customer feedback":
      - listitem:
        - strong: Booking confirmed
        - paragraph: Your booking is confirmed!
        - text: 10:00 AM
      - listitem:
        - strong: Out for delivery
        - paragraph: Your order is on the way!
        - text: 2:00 PM
      - listitem:
        - strong: Thank you!
        - paragraph: Your feedback means a lot.
        - text: Private feedback
  `);
  await expect(page.getByRole("button", { name: "Replay demo" })).toBeVisible();
});

test("no-JavaScript visitors receive the complete homepage story and original destinations", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 568 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Keep every customer in the loop." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Turn updates into loyal customers." }),
    ).toBeVisible();
    for (const card of await page.locator(`${loyalty} li`).all())
      await expect(card).toBeVisible();
    await expect(page.locator(`${loyalty} a`)).toHaveAttribute("href", "/signup");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(page.locator("[data-motion-ready]")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("preserved product demo still pauses, resumes and replays inside the new surround", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#features");
  const demo = page.getByRole("region", {
    name: "Illustrative MyKustomers workspace preview",
  });
  await demo.getByRole("button", { name: "Replay demo" }).click();
  await expect(page.getByTestId("demo-booking-status")).toHaveText("Created");
  await demo.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("demo-booking-status")).toHaveText("Created");
  await demo.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.getByTestId("demo-booking-status")).toHaveText("Confirmed");
  await demo.getByRole("button", { name: "Replay demo" }).click();
  await expect(page.getByTestId("demo-booking-status")).toHaveText("Created");
});
