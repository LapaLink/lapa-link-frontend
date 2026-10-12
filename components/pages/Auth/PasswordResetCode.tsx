import { AuthLayout } from "@/components/layouts"
import { OtpCodeForm } from "./common"
export function PasswordResetCode() {
  return (
    <AuthLayout
      title="Проверьте почту"
      description="Введите код из письма, чтобы перейти к смене пароля."
    >
      <OtpCodeForm flow="password-reset" />
    </AuthLayout>
  )
}
