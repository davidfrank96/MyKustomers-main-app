import { expect, type Page } from "@playwright/test";

const viewports = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [414, 896],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
] as const;
const screenshotWidths = new Set([320, 390, 430, 768, 1024]);
const directory = "output/playwright/secure-share-modal";

// Redact capability values in the screenshot only. The real input/state stays
// intact for the existing clipboard, reload and lifecycle assertions.
function screenshotStyle(variant: "confirmation" | "feedback") {
  return `
    nextjs-portal { visibility: hidden !important; }
    input[readonly] { color: transparent !important; }
    [data-secure-share-link]::after {
      content: "https://mykustomers.com/${variant === "feedback" ? "f" : "c"}/[secure-link]";
      position: absolute; left: 10px; right: 44px; top: 10px;
      color: #17201d; font-size: 16px; line-height: 24px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      pointer-events: none;
    }
  `;
}

export async function captureConfirmationPanel(page: Page, state: "before" | "after") {
  const previous = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.locator("#customer-confirmation");
  const emailTrigger = panel.getByRole("button", { name: "Send confirmation to" });
  await expect(emailTrigger).toBeVisible();
  const expandEmail =
    state === "after" && (await emailTrigger.getAttribute("aria-expanded")) === "false";
  if (expandEmail) await emailTrigger.click();
  if (state === "after")
    await expect(panel.getByLabel("Customer email", { exact: true })).toBeVisible();
  await panel.screenshot({
    path: `${directory}/confirmation-panel-${state}-390.png`,
    // A tall element capture should not include repeated fixed shell/toast overlays.
    style: `${screenshotStyle("confirmation")}
      header, nav[aria-label="Mobile vendor navigation"],
      [role="region"][aria-label^="Notifications"] { visibility: hidden !important; }
    `,
    caret: "initial",
  });
  if (expandEmail) await emailTrigger.click();
  if (previous) await page.setViewportSize(previous);
}

/** Audits a legitimately generated share dialog in the real booking journey. */
export async function auditSecureShareModal(
  page: Page,
  variant: "confirmation" | "feedback",
  project: string,
) {
  const previous = page.viewportSize();
  const title = variant === "feedback" ? "Share feedback request" : "Share with customer";
  const dialog = page.getByRole("dialog", { name: title });
  const message = dialog.getByRole("textbox", { name: "Message", exact: true });
  const link = dialog.getByRole("textbox", {
    name: variant === "feedback" ? "Feedback link" : "Confirmation link",
    exact: true,
  });
  const originalMessage = await message.inputValue();
  const originalUrl = await link.inputValue();
  const edited =
    "Thank you, please review this secure request. Tea & cake 🍰?\nYour reply matters.";
  const closeButtons = dialog.getByRole("button", { name: "Close", exact: true });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(link).toHaveAttribute("readonly");
  await expect(message).toHaveAttribute("maxlength", "1200");
  await expect(closeButtons.first()).toBeFocused();
  const actions = ["WhatsApp", "Telegram", "Share...", "Copy message", "Copy link"];

  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await closeButtons.first().focus();
    await dialog.evaluate((element) => {
      element.scrollTop = 0;
    });
    if (screenshotWidths.has(width)) {
      await page.screenshot({
        path: `${directory}/${project}-${variant}-${width}-default.png`,
        style: screenshotStyle(variant),
        caret: "initial",
      });
    }
    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const title = element.querySelector("h2")!;
      const close = element.querySelector<HTMLButtonElement>(
        'button[aria-label="Close"]',
      )!;
      const heading = title.getBoundingClientRect();
      const closeRect = close.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(title).paddingRight);
      const input = element.querySelector("input")!.getBoundingClientRect();
      const copy = element
        .querySelector("[data-secure-share-link] button")!
        .getBoundingClientRect();
      const textarea = element.querySelector("textarea")!.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        pageOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headingRight: heading.right - padding,
        closeLeft: closeRect.left,
        inputRight: input.right,
        copyLeft: copy.left,
        textareaLeft: textarea.left,
        textareaRight: textarea.right,
        bodyOverflow: getComputedStyle(document.body).overflow,
        nestedScrollers: Array.from(element.querySelectorAll("*:not(textarea)")).filter(
          (child) =>
            /auto|scroll/.test(getComputedStyle(child).overflowY) &&
            child.scrollHeight > child.clientHeight,
        ).length,
      };
    });
    expect(
      geometry.pageOverflow,
      `${variant} ${width}: page overflow`,
    ).toBeLessThanOrEqual(0);
    expect(geometry.x).toBeGreaterThanOrEqual(11);
    expect(geometry.y).toBeGreaterThanOrEqual(11);
    expect(geometry.right).toBeLessThanOrEqual(width - 11);
    expect(geometry.bottom).toBeLessThanOrEqual(height - 11);
    expect(geometry.width).toBeLessThanOrEqual(640);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.headingRight).toBeLessThanOrEqual(geometry.closeLeft);
    expect(geometry.inputRight).toBeLessThanOrEqual(geometry.copyLeft + 1);
    expect(geometry.textareaLeft).toBeGreaterThan(geometry.x);
    expect(geometry.textareaRight).toBeLessThan(geometry.right);
    expect(geometry.bodyOverflow).toBe("hidden");
    expect(geometry.nestedScrollers).toBe(0);
    await expect(closeButtons.first()).toBeInViewport();

    const boxes = [];
    for (const name of actions) {
      const button = dialog.getByRole("button", { name, exact: true });
      const size = await button.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const label = element.lastElementChild!;
        return {
          width: box.width,
          height: box.height,
          y: box.y,
          fontSize: parseFloat(getComputedStyle(element).fontSize),
          labelWidth: label.clientWidth,
          labelScrollWidth: label.scrollWidth,
          labelFont: getComputedStyle(label).font,
          clipped: label.scrollWidth > label.clientWidth + 1,
        };
      });
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
      expect(size.fontSize).toBeGreaterThanOrEqual(13);
      expect(size.clipped, `${name} at ${width}: ${JSON.stringify(size)}`).toBe(false);
      boxes.push(size);
    }
    expect(
      Math.max(...boxes.map((box) => box.width)) -
        Math.min(...boxes.map((box) => box.width)),
    ).toBeLessThan(1);
    expect(boxes[0].y).toBe(boxes[2].y);
    if (width < 390) expect(boxes[3].y).toBeGreaterThan(boxes[0].y);
    else expect(boxes[0].y).toBe(boxes[4].y);
    for (const button of [
      closeButtons.first(),
      dialog.getByRole("button", { name: `Copy ${variant} link`, exact: true }),
    ]) {
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    if (screenshotWidths.has(width)) {
      await message.fill(edited);
      await closeButtons.first().focus();
      await dialog.evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: `${directory}/${project}-${variant}-${width}-edited.png`,
        style: screenshotStyle(variant),
        caret: "initial",
      });
      await message.fill(originalMessage);
    }
    if (width === 320) {
      expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
      const backgroundY = await page.evaluate(() => window.scrollY);
      for (const name of actions) {
        const button = dialog.getByRole("button", { name, exact: true });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport();
      }
      await closeButtons.last().scrollIntoViewIfNeeded();
      await expect(closeButtons.last()).toBeInViewport();
      await page.screenshot({
        path: `${directory}/${project}-${variant}-320-actions.png`,
        style: screenshotStyle(variant),
        caret: "initial",
      });
      if (project.includes("webkit")) {
        // Mobile WebKit does not implement Playwright's mouse.wheel transport.
        // Attempt keyboard scrolling beyond the modal's bottom edge instead.
        await closeButtons.last().focus();
        await page.keyboard.press("PageDown");
      } else {
        await page.mouse.move(2, 2);
        await page.mouse.wheel(0, 500);
      }
      expect(await page.evaluate(() => window.scrollY)).toBe(backgroundY);
      expect(await dialog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await message.fill(edited);
  await message.focus();
  await expect(message).toBeFocused();
  await page.screenshot({
    path: `${directory}/${project}-${variant}-390-focused.png`,
    style: screenshotStyle(variant),
    caret: "initial",
  });
  // Reduced visual viewport is a keyboard-layout simulation, not a physical iOS keyboard.
  await page.setViewportSize({ width: 390, height: 480 });
  await message.scrollIntoViewIfNeeded();
  await expect(message).toBeInViewport();
  await page.screenshot({
    path: `${directory}/${project}-${variant}-390-keyboard-simulation.png`,
    style: screenshotStyle(variant),
    caret: "initial",
  });
  await closeButtons.last().focus();
  await expect(closeButtons.last()).toBeInViewport();
  await page.keyboard.press("Tab");
  await expect(closeButtons.first()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButtons.last()).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });

  // Both close affordances, Escape and backdrop retain the current draft and raw URL.
  for (const method of ["bottom", "x", "escape", "backdrop"]) {
    if (method === "bottom") await closeButtons.last().click();
    else if (method === "x") await closeButtons.first().click();
    else if (method === "escape") await page.keyboard.press("Escape");
    else await page.mouse.click(2, 2);
    await expect(dialog).toHaveCount(0);
    const trigger = page.getByRole("button", { name: title, exact: true });
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(message).toHaveValue(edited);
    await expect(link).toHaveValue(originalUrl);
  }
  await message.fill(originalMessage);
  if (previous) await page.setViewportSize(previous);
  await dialog.evaluate((element) => {
    element.scrollTop = 0;
  });
}
