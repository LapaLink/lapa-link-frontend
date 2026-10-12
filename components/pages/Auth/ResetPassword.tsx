import { AuthLayout } from "@/components/layouts"
import { ResetPasswordForm } from "./common"
export function ResetPassword() {
  return (
    <AuthLayout
      title="Новый пароль"
      description="Введите код из письма и придумайте новый пароль."
    >
      <ResetPasswordForm />
    </AuthLayout>
  )
}
