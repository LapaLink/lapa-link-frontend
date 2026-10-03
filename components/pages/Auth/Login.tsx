import { AuthLayout } from "@/components/layouts"
import { LoginForm } from "./common/LoginForm"
export function Login() {
  return (
    <AuthLayout
      title="Рады вас видеть"
      description="Войдите, чтобы продолжить помогать животным рядом."
    >
      <LoginForm />
    </AuthLayout>
  )
}
