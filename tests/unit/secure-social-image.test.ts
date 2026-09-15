// @vitest-environment node
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { renderSecureSocialImage } from "@/features/businesses/secure-social-image";

describe("secure preview privacy and failure boundary", () => {
  for (const kind of ["confirmation", "feedback"] as const) {
    it(`${kind} emits the same PNG regardless of unrelated private fields`, async () => {
      const identity = { businessName: "Harbour Studio", logo: null };
      const extra = {
        ...identity,
        customerName: "Private Customer",
        customerEmail: "private@example.invalid",
        customerPhone: "+353000000000",
        totalAmount: 45900,
        bookingReference: "PRIVATE-REF",
        token: "sensitive-token",
        tokenHash: "sensitive-hash",
        secureUrl: "https://example.invalid/c/sensitive-token",
        feedback: "Confidential answer",
        history: ["Private operational event"],
      };
      const safe = await renderSecureSocialImage(kind, identity);
      const withPrivateFields = await renderSecureSocialImage(kind, extra);
      const bytes = Buffer.from(await safe.arrayBuffer());
      expect(Buffer.from(await withPrivateFields.arrayBuffer())).toEqual(bytes);
      expect(await sharp(bytes).metadata()).toMatchObject({
        format: "png",
        width: 1200,
        height: 630,
      });
      expect(bytes).not.toEqual(
        await readFile(
          "public/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png",
        ),
      );
      expect(safe.headers.get("cache-control")).toContain("no-store");
      expect(safe.headers.get("referrer-policy")).toBe("no-referrer");
      expect(safe.headers.get("x-robots-tag")).toContain("noindex");
    });
    it(`${kind} contains a render failure in a generic branded PNG without a stack`, async () => {
      const response = await renderSecureSocialImage(kind, {
        businessName: "Private business context",
        logo: Buffer.from("invalid image"),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        await readFile(
          "public/brand/mykustomers/v1/social/mykustomers-open-graph-1200x630.png",
        ),
      );
    });
  }
});
