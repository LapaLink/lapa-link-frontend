import type {
  LoginDto,
  Tokens,
  OtpRequestResponse,
  RegistrationCompleteDto,
  PasswordResetDto,
  OtpConfirmDto,
  OtpConfirmResponse,
} from "@/types"
import { post } from "./instance"

export const authApi = {
  login: (data: LoginDto) => post<Tokens>("/auth/login", data),
  // Public endpoints: sent without Authorization even if stale tokens remain.
  /** Sends a registration code; a repeated call with the same email is a resend. */
  register: (email: string) =>
    post<OtpRequestResponse>("/auth/registration", { email }),
  completeRegistration: (data: RegistrationCompleteDto) =>
    post<Tokens>("/auth/registration/complete", data),
  /** Exchanges a one-time code for a confirmation token; shared by all OTP flows. */
  confirmOtp: (data: OtpConfirmDto) =>
    post<OtpConfirmResponse>("/auth/otp/confirm", data),
  forgotPassword: (email: string) =>
    post<OtpRequestResponse>("/auth/password/forgot", { email }),
  resetPassword: (data: PasswordResetDto) =>
    post<void>("/auth/password/reset", data),
}
