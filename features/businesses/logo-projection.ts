import "server-only";
import sharp from "sharp";
import { getBusinessLogoPublicUrl } from "./logo-public";

const maxLogoBytes = 200 * 1024;

// Processes only the bounded canonical asset; never accepts an arbitrary URL.
export async function readBusinessLogoPng(logoPath: string | null, size = 280) {
  const url = getBusinessLogoPublicUrl(logoPath);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get("content-length")) > maxLogoBytes
    )
      return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxLogoBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const source = Buffer.concat(chunks);
    const metadata = await sharp(source, { limitInputPixels: 512 * 512 }).metadata();
    if (
      metadata.format !== "webp" ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 512 ||
      metadata.height > 512 ||
      (metadata.pages ?? 1) > 1
    )
      return null;
    const { data, info } = await sharp(source, { limitInputPixels: 512 * 512 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Trim fully transparent pixels ONLY. Preserve opaque whitespace, shadows,
    // and even faint antialiasing; the canonical stored WebP is never modified.
    let left = info.width,
      top = info.height,
      right = -1,
      bottom = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] !== 0) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (right < left) return null;
    return await sharp(data, { raw: info })
      .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}
