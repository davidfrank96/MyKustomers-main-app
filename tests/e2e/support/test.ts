import { randomUUID } from "node:crypto";
import { expect, test as base } from "@playwright/test";

type E2EFixtures = {
  rateLimitSourceIsolation: void;
};

export const test = base.extend<E2EFixtures>({
  rateLimitSourceIsolation: [
    async ({ context }, use) => {
      const token = randomUUID().replaceAll("-", "").slice(0, 16);
      const segments = token.match(/.{4}/g) ?? ["0", "0", "0", "0"];
      await context.setExtraHTTPHeaders({
        "x-forwarded-for": `2001:db8:${segments.join(":")}:0:1`,
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Locator, Page, Route } from "@playwright/test";
