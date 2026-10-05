import type { Area } from "react-easy-crop"

export async function cropImage(
  source: string,
  area: Area,
  maxSize: number,
  fileName: string,
): Promise<File> {
  const image = new Image()
  image.src = source
  await image.decode()
  const canvas = document.createElement("canvas")
  const size = Math.max(1, Math.min(maxSize, Math.round(area.width)))
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")
  if (!context)
    throw new Error("Не удалось подготовить фото. Попробуйте ещё раз.")
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    size,
    size,
  )
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("Не удалось обработать фото.")),
      "image/png",
    )
  })
  return new File([blob], fileName, { type: "image/png" })
}
