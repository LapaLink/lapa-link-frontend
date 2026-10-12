import { AuthLayout } from "@/components/layouts"
import { OtpCodeForm } from "./common"
export function RegistrationCode() {
  return (
    <AuthLayout
      title="Проверьте вашу почту"
      description="Введите код из письма, чтобы подтвердить почту."
    >
      <OtpCodeForm flow="registration" />
    </AuthLayout>
  )
}
