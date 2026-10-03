import { AuthLayout } from "@/components/layouts"
import { VerificationForm } from "./common/VerificationForm"
export function VerifyEmail() {
  return (
    <AuthLayout
      title="Проверьте вашу почту"
      description="Введите код из письма, чтобы завершить регистрацию."
    >
      <VerificationForm />
    </AuthLayout>
  )
}
