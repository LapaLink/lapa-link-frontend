import { CASE_PHOTOS_MAX, IMAGE_ACCEPT, imageSchema } from "@/lib/validation"
import { downscaleImage } from "./downscaleImage"

/**
 * Client-side checks before a gallery upload: fits the free slots, keeps
 * JPEG/PNG/GIF/WEBP up to 5 MB (after scaling large photos down). Rejected
 * files are skipped and the first problem is returned as `error`; the server
 * still validates everything itself.
 */
export async function prepareCasePhotos(
  selected: readonly File[],
  freeSlots: number,
): Promise<{ files: File[]; error: string }> {
  if (freeSlots <= 0)
    return {
      files: [],
      error: `В объявлении может быть не больше ${CASE_PHOTOS_MAX} фото.`,
    }
  let error =
    selected.length > freeSlots
      ? `Добавлены первые ${freeSlots}: в объявлении может быть не больше ${CASE_PHOTOS_MAX} фото.`
      : ""
  const files: File[] = []
  for (const file of selected.slice(0, freeSlots)) {
    // Format first: no point scaling a file that will be rejected anyway.
    if (file.size === 0 || !IMAGE_ACCEPT.split(",").includes(file.type)) {
      error ||= imageSchema.safeParse(file).error?.issues[0].message ?? ""
      continue
    }
    const scaled = await downscaleImage(file)
    const result = imageSchema.safeParse(scaled)
    if (result.success) files.push(scaled)
    else error ||= result.error.issues[0].message
  }
  return { files, error }
}
