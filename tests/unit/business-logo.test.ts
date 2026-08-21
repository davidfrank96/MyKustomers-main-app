import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  BUSINESS_LOGO_OUTPUT_MIME,
  BusinessLogoValidationError,
  MAX_LOGO_INPUT_BYTES,
  MAX_LOGO_OUTPUT_BYTES,
  MAX_LOGO_OUTPUT_EDGE,
  optimizeBusinessLogo,
} from "@/features/businesses/logo";

async function sourceLogo(format: "png" | "jpeg" | "webp") {
  const image = sharp({
    create: {
      width: 900,
      height: 450,
      channels: 4,
      background: { r: 22, g: 110, b: 88, alpha: 0.9 },
    },
  });

  if (format === "jpeg") {
    return image.jpeg({ quality: 95 }).toBuffer();
  }
  if (format === "webp") {
    return image.webp({ quality: 95 }).toBuffer();
  }
  return image.png().toBuffer();
}

describe("business logo processing", () => {
  it.each([
    ["png", "image/png", "logo.png"],
    ["jpeg", "image/jpeg", "logo.jpg"],
    ["webp", "image/webp", "logo.webp"],
  ] as const)("accepts and normalizes %s sources", async (format, contentType, fileName) => {
    const optimized = await optimizeBusinessLogo({
      buffer: await sourceLogo(format),
      contentType,
      fileName,
    });

    expect(optimized.contentType).toBe(BUSINESS_LOGO_OUTPUT_MIME);
    expect(optimized.width).toBeLessThanOrEqual(MAX_LOGO_OUTPUT_EDGE);
    expect(optimized.height).toBeLessThanOrEqual(MAX_LOGO_OUTPUT_EDGE);
    expect(optimized.size).toBeLessThanOrEqual(MAX_LOGO_OUTPUT_BYTES);
    expect((await sharp(optimized.buffer).metadata()).format).toBe("webp");
  });

  it("compresses noisy source photography and bounds persisted dimensions", async () => {
    const source = await sharp(randomBytes(1200 * 1200 * 3), {
      raw: { width: 1200, height: 1200, channels: 3 },
    })
      .jpeg({ quality: 92 })
      .toBuffer();
    expect(source.byteLength).toBeLessThan(MAX_LOGO_INPUT_BYTES);

    const optimized = await optimizeBusinessLogo({
      buffer: source,
      contentType: "image/jpeg",
      fileName: "photo.jpeg",
    });

    expect(optimized.size).toBeLessThan(source.byteLength);
    expect(optimized.size).toBeLessThanOrEqual(MAX_LOGO_OUTPUT_BYTES);
    expect(Math.max(optimized.width, optimized.height)).toBeLessThanOrEqual(512);
  });

  it("rejects unsupported types, extension mismatches, and content mismatches", async () => {
    const png = await sourceLogo("png");

    await expect(
      optimizeBusinessLogo({ buffer: png, contentType: "image/svg+xml", fileName: "logo.svg" }),
    ).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(
      optimizeBusinessLogo({ buffer: png, contentType: "image/png", fileName: "logo.jpg" }),
    ).rejects.toMatchObject({ code: "extension_mismatch" });
    await expect(
      optimizeBusinessLogo({ buffer: png, contentType: "image/jpeg", fileName: "logo.jpg" }),
    ).rejects.toMatchObject({ code: "content_mismatch" });
  });

  it("rejects oversized input bytes and source dimensions", async () => {
    await expect(
      optimizeBusinessLogo({
        buffer: Buffer.alloc(MAX_LOGO_INPUT_BYTES + 1),
        contentType: "image/png",
        fileName: "logo.png",
      }),
    ).rejects.toBeInstanceOf(BusinessLogoValidationError);

    const overwide = await sharp({
      create: {
        width: 6001,
        height: 10,
        channels: 3,
        background: "white",
      },
    })
      .png()
      .toBuffer();
    await expect(
      optimizeBusinessLogo({
        buffer: overwide,
        contentType: "image/png",
        fileName: "wide.png",
      }),
    ).rejects.toMatchObject({ code: "dimensions_too_large" });
  });
});
