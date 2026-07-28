"use server";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { generateVerificationCode } from "@/lib/auth/generate-verification-code";
import { sendVerificationCodeEmail } from "@/lib/email/send";

const CODE_TTL_MS = 15 * 60 * 1000;

// "Регистрация" здесь — НЕ создание нового аккаунта с нуля (это раньше
// было открыто для любого email, дыра в безопасности): аккаунт уже создан
// администратором/руководителем департамента (см. createEmployeeAction,
// createManagerAction). Этот флоу только подтверждает, что человек
// реально владеет своей корпоративной почтой @tortay.kz, и даёт ему
// самому поставить пароль вместо того, что ему выдали при создании.
export async function requestVerificationCodeAction(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  if (!email) {
    throw new Error("Введите email");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Сотрудник с таким email не найден — обратитесь к руководителю");
  }
  if (!user.isActive) {
    throw new Error("Сотрудник с таким email не найден — обратитесь к руководителю");
  }

  const code = generateVerificationCode();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationCode: code,
      verificationCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  await sendVerificationCodeEmail({ to: email, code });
}

export async function verifyCodeAndSetPasswordAction(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const code = (formData.get("code") as string | null)?.trim();
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!email || !code || !password) {
    throw new Error("Заполните все поля");
  }
  if (password.length < 6) {
    throw new Error("Пароль должен быть не короче 6 символов");
  }
  if (password !== confirmPassword) {
    throw new Error("Пароли не совпадают");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (
    !user ||
    !user.isActive ||
    !user.verificationCode ||
    !user.verificationCodeExpiresAt ||
    user.verificationCodeExpiresAt < new Date()
  ) {
    throw new Error("Код недействителен или истёк — запросите новый");
  }
  if (user.verificationCode !== code) {
    throw new Error("Неверный код");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    },
  });
}
