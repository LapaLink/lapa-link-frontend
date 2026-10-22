/** Longest side of an uploaded case photo; larger photos are scaled down. */
export const PHOTO_MAX_SIDE = 2048

/**
 * Scales a photo down to `maxSide` on its longest side to save traffic and
 * stay under the 5 MB limit. GIFs (may be animated), small photos and
 * anything that fails to decode are returned as is; the server strips EXIF.
 */
export async function downscaleImage(
  file: File,
  maxSide = PHOTO_MAX_SIDE,
): Promise<File> {
  if (file.type === "image/gif") return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = maxSide / Math.max(bitmap.width, bitmap.height)
  if (scale >= 1) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, file.type, 0.9),
  )
  // Keep the original if encoding failed or did not help.
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name, { type: blob.type || file.type })
}
