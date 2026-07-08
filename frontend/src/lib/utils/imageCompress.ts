/**
 * Downscale an image File to at most `maxSide` pixels on the long edge and
 * re-encode as JPEG at the given quality. Runs entirely on the client via
 * a canvas — no dependency, no network.
 *
 * Returns the compressed Blob. PNGs with transparency lose it (JPEG); if
 * that matters, pass `type = "image/png"`.
 */
export async function compressImage(
  file: File,
  {
    maxSide = 1600,
    quality = 0.85,
    type = "image/jpeg",
  }: { maxSide?: number; quality?: number; type?: string } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))),
      type,
      quality,
    );
  });
}
