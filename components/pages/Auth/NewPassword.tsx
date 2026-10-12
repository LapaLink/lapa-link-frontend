import { AuthLayout } from "@/components/layouts"
import { NewPasswordForm } from "./common"
export function NewPassword() {
  return (
    <AuthLayout
      title="Новый пароль"
      description="После смены пароля войдите в аккаунт заново."
    >
      <NewPasswordForm />
    </AuthLayout>
  )
}
