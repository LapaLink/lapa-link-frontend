import type {
  LoginDto,
  RegistrationDto,
  VerificationDto,
  Tokens,
  OtpResponse,
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
}
