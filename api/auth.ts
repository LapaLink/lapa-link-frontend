import type {
  LoginDto,
  RegistrationDto,
  VerificationDto,
  Tokens,
  OtpResponse,
  PasswordForgotResponse,
  PasswordResetDto,
} from "@/types"
import { post } from "./instance"

export const authApi = {
  login: (data: LoginDto) => post<Tokens>("/auth/login", data),
  register: (data: RegistrationDto) =>
    post<OtpResponse>("/auth/registration", data),
  verify: ({ userId, ...data }: VerificationDto) =>
    post<Tokens>(`/auth/verification/${encodeURIComponent(userId)}`, data),
  resend: (userId: string) =>
    post<OtpResponse>(
      `/auth/verification/${encodeURIComponent(userId)}/resend`,
    ),
  // Public endpoints: sent without Authorization even if stale tokens remain.
  forgotPassword: (email: string) =>
    post<PasswordForgotResponse>("/auth/password/forgot", { email }),
  resetPassword: (data: PasswordResetDto) =>
    post<void>("/auth/password/reset", data),
}
