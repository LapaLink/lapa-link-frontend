export const ONBOARDING_STEPS = [
  {
    label: "Знакомство",
    description:
      "Как к вам обращаться и где вы живёте. Имя и фото увидят авторы объявлений, когда вы откликнетесь.",
  },
  {
    label: "Уведомления",
    description:
      "Где и о чём вам сообщать. Всё это можно поменять потом в профиле.",
  },
  {
    label: "Чем помочь",
    description:
      "Отметьте, чем готовы помогать, — будем присылать объявления рядом, где нужна такая помощь.",
  },
  {
    label: "Мой район",
    description:
      "Точка, от которой считаем радиус помощи. Другим пользователям не видна.",
  },
] as const

/** Props every step gets from the wizard. */
export type StepProps = {
  onNext: () => void
  onBack?: () => void
  onSkip: () => void
}
