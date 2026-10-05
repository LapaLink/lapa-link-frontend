import type { Area } from "react-easy-crop"

export async function cropAvatar(source: string, area: Area): Promise<File> {
  const image = new Image()
  image.src = source
  await image.decode()
  const canvas = document.createElement("canvas")
  const size = Math.min(512, Math.round(area.width))
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
  return new File([blob], "avatar.png", { type: "image/png" })
}
