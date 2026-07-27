import crypto from "crypto";

// Читаемый временный пароль (без похожих на вид символов 0/O/1/l) — его
// один раз показывают в письме, на экране администратора он никогда не
// отображается. Общий для создания и руководителей (create-manager-dialog.tsx),
// и обычных сотрудников (new-employee-dialog.tsx).
const PASSWORD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

export function generateTemporaryPassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return password;
}
