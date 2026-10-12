import { AuthLayout } from "@/components/layouts"
import { CompleteRegistrationForm } from "./common"
export function CompleteRegistration() {
  return (
    <AuthLayout
      title="Почти готово"
      description="Придумайте пароль и расскажите, как к вам обращаться."
    >
      <CompleteRegistrationForm />
    </AuthLayout>
  )
}
