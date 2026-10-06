import { z } from "zod"

const imageFormats = ["image/jpeg", "image/png", "image/gif", "image/webp"]
export const IMAGE_ACCEPT = imageFormats.join(",")
export const imageSchema = z
  .file()
  .min(1, "Этот файл пустой. Выберите другое фото.")
  .max(5 * 1024 * 1024, "Фото слишком большое. Выберите файл до 5 МБ.")
  .mime(imageFormats, "Выберите фото в формате JPEG, PNG, GIF или WEBP.")
