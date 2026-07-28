import crypto from "crypto";

// 6-значный числовой код для подтверждения email при "регистрации"
// (первый вход/самостоятельная установка пароля) — см. lib/auth/actions.ts.
export function generateVerificationCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}
