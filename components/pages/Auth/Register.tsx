import { AuthLayout } from "@/components/layouts"
import { RegisterForm } from "./common/RegisterForm"
export function Register() {
  return (
    <AuthLayout
      title="Давайте знакомиться"
      description="Создайте аккаунт — вместе делать добро проще."
    >
      <RegisterForm />
    </AuthLayout>
  )
}
