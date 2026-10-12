import {
  passwordResetStorage,
  type OtpConfirmation,
  type PendingOtp,
} from "./otpFlow"

export type PendingPasswordReset = PendingOtp
export type PasswordResetConfirmation = OtpConfirmation

export const {
  savePending: savePendingPasswordReset,
  readPending: readPendingPasswordReset,
  updatePending: updatePendingPasswordReset,
  clearPending: clearPendingPasswordReset,
  saveConfirmation: savePasswordResetConfirmation,
  readConfirmation: readPasswordResetConfirmation,
  clearConfirmation: clearPasswordResetConfirmation,
  setEmail: setPasswordResetEmail,
  takeEmail: takePasswordResetEmail,
} = passwordResetStorage

// One-shot hand-off of the success notice to the login screen.
const PASSWORD_RESET_DONE_KEY = "lapalink.password-reset-done"
export function markPasswordResetDone() {
  sessionStorage.setItem(PASSWORD_RESET_DONE_KEY, "1")
}
export function takePasswordResetDone() {
  const done = sessionStorage.getItem(PASSWORD_RESET_DONE_KEY) === "1"
  sessionStorage.removeItem(PASSWORD_RESET_DONE_KEY)
  return done
}
