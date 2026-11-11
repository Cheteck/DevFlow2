export type OtpPurpose =
  | "registration"
  | "login"
  | "email_verification"
  | "phone_verification"
  | "password_reset"
  | "transaction_confirmation"
  | "custom";