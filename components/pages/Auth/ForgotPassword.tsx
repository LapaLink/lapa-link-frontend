import { AuthLayout } from "@/components/layouts"
import { ForgotPasswordForm } from "./common"
export function ForgotPassword() {
  return (
    <AuthLayout
      title="Забыли пароль?"
      description="Укажите почту, на которую зарегистрирован аккаунт, и мы пришлём код для смены пароля."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
