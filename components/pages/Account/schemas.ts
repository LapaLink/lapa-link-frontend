import { z } from "zod"
import { emailSchema, passwordSchema, otpCodeSchema } from "@/lib/validation"
import type {
  CreateHelpOfferDto,
  CurrentUser,
  HelpOffer,
  NeedType,
  UpdateHelpOfferDto,
  UpdateProfileDto,
} from "@/types"

export {
  IMAGE_ACCEPT as AVATAR_ACCEPT,
  imageSchema as avatarSchema,
} from "@/lib/validation"

export const emailChangeSchema = z.object({
  newEmail: emailSchema,
  password: passwordSchema,
})
export const passwordChangeSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema.refine(
    (value) => Array.from(value).length >= 8,
    "Придумайте пароль хотя бы из 8 символов.",
  ),
})
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>
export const accountDeletionSchema = z.object({ password: passwordSchema })
export type AccountDeletionValues = z.infer<typeof accountDeletionSchema>
export const emailConfirmationSchema = z.object({ code: otpCodeSchema })
export type EmailChangeValues = z.infer<typeof emailChangeSchema>
export type EmailConfirmationValues = z.infer<typeof emailConfirmationSchema>

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/

/** Drops spaces, brackets and dashes; the backend takes `+375291234567` only. */
export function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "")
}

/** True for an empty value or `+?` and 7..15 digits once spaces are dropped. */
export function isValidPhone(value: string | undefined) {
  return !value?.trim() || PHONE_PATTERN.test(normalizePhone(value))
}

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Укажите ваше имя.")
    .max(100, "Имя должно быть не длиннее 100 символов."),
  cityCode: z.string().max(64, "Выберите город из списка."),
  bio: z.string().max(1000, "Расскажите о себе в пределах 1000 символов."),
  /** Optional; shown to administrators only. */
  phone: z
    .string()
    .optional()
    .refine(
      isValidPhone,
      "Введите номер в формате +375291234567: от 7 до 15 цифр.",
    ),
})
export type ProfileValues = z.infer<typeof profileSchema>

/**
 * PUT /account/profile replaces every field, so the home point is sent as is.
 * An empty phone sends null and clears the number; changing it resets its
 * confirmation, sending the same number keeps it.
 */
export function toUpdateProfileDto(
  values: ProfileValues,
  user: CurrentUser,
): UpdateProfileDto {
  return {
    displayName: values.displayName,
    cityCode: values.cityCode === "__none" ? null : values.cityCode,
    bio: values.bio.trim() ? values.bio : null,
    phone: normalizePhone(values.phone ?? "") || null,
    homeLatitude: user.homeLatitude ?? null,
    homeLongitude: user.homeLongitude ?? null,
  }
}

export const HELP_OFFER_AVAILABILITY_MAX = 500
const radiusMessage = "Укажите радиус от 1 до 100 км."

export const helpOfferSchema = z.object({
  type: z.string().min(1, "Выберите вид помощи."),
  radiusKm: z
    .number({ error: radiusMessage })
    .int(radiusMessage)
    .min(1, radiusMessage)
    .max(100, radiusMessage),
  availability: z
    .string()
    .trim()
    .max(
      HELP_OFFER_AVAILABILITY_MAX,
      `Текст должен быть не длиннее ${HELP_OFFER_AVAILABILITY_MAX} символов.`,
    ),
})
export type HelpOfferValues = z.infer<typeof helpOfferSchema>

export function getHelpOfferValues(offer?: HelpOffer): HelpOfferValues {
  return {
    type: offer?.type ?? "",
    radiusKm: offer?.radiusKm ?? 10,
    availability: offer?.availability ?? "",
  }
}

export function toCreateHelpOfferDto(
  values: HelpOfferValues,
): CreateHelpOfferDto {
  return {
    type: values.type,
    radiusKm: values.radiusKm,
    ...(values.availability && { availability: values.availability }),
  }
}

/** Only changed fields; an emptied availability is sent as "" to clear it. */
export function toUpdateHelpOfferDto(
  values: HelpOfferValues,
  offer: HelpOffer,
): UpdateHelpOfferDto {
  const initial = getHelpOfferValues(offer)
  const result: UpdateHelpOfferDto = {}
  if (values.radiusKm !== initial.radiusKm) result.radiusKm = values.radiusKm
  if (values.availability !== initial.availability)
    result.availability = values.availability
  return result
}

/** Active need types the user has no offer for yet. */
export function getAvailableHelpTypes(
  types: readonly NeedType[] | undefined,
  offers: readonly HelpOffer[] | undefined,
): NeedType[] {
  const taken = new Set(offers?.map((offer) => offer.type))
  return (types ?? []).filter((type) => type.active && !taken.has(type.code))
}
