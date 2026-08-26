import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import sharp from "sharp";

const CAMERA_WIDTH = 2400;
const CAMERA_HEIGHT = 1800;

const fixtureCache = new Map<number, Promise<Buffer>>();

async function buildCameraJpeg(targetBytes: number) {
  const pixels = randomBytes(CAMERA_WIDTH * CAMERA_HEIGHT * 3);
  let encoded: Buffer | null = null;
  for (const quality of [82, 76, 70, 64]) {
    const candidate = await sharp(pixels, {
      raw: {
        width: CAMERA_WIDTH,
        height: CAMERA_HEIGHT,
        channels: 3,
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg({ quality, chromaSubsampling: "4:4:4" })
      .toBuffer();
    if (candidate.byteLength <= targetBytes) {
      encoded = candidate;
      break;
    }
  }

  if (!encoded) {
    throw new Error(
      `Camera fixture could not be encoded below ${targetBytes} bytes.`,
    );
  }

  // JPEG readers ignore bytes after the end marker. Padding lets boundary tests use
  // a valid, camera-resolution image with an exact controlled source byte count.
  return Buffer.concat([encoded, randomBytes(targetBytes - encoded.byteLength)]);
}

export function createCameraLogoJpeg(targetBytes: number) {
  const cached = fixtureCache.get(targetBytes);
  if (cached) return cached;

  const fixture = buildCameraJpeg(targetBytes);
  fixtureCache.set(targetBytes, fixture);
  return fixture;
}

const transportSizeKey = "e2e-business-logo-transport-bytes";

export async function installBusinessLogoTransportObserver(page: Page) {
  await page.addInitScript((storageKey) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const request = new Request(input, init);
      if (
        request.method === "POST" &&
        new URL(request.url).pathname.match(/^\/api\/businesses\/[^/]+\/logo$/)
      ) {
        const bodyBytes = (await request.clone().arrayBuffer()).byteLength;
        window.sessionStorage.setItem(storageKey, String(bodyBytes));
      }
      return originalFetch(request);
    };
  }, transportSizeKey);
}

export function readObservedBusinessLogoTransportBytes(page: Page) {
  return page.evaluate((storageKey) => {
    const value = window.sessionStorage.getItem(storageKey);
    return value ? Number(value) : null;
  }, transportSizeKey);
}
