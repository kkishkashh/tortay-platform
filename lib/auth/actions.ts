"use server";

import bcrypt from "bcryptjs";
import { SystemRole, UserType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Самостоятельная регистрация — в отличие от createEmployeeAction (лист
// "Сотрудники", доступен только руководителю), сюда попадает кто угодно
// с рабочим email. Системная роль намеренно не берётся из формы: любой
// желающий не должен получить РУКОВОДИТЕЛЯ себе сам — до РУКОВОДИТЕЛЯ
// уже существующий руководитель повышает вручную в карточке сотрудника
// (см. updateEmployeeDetailsAction в lib/employees/actions.ts).
export async function registerAction(formData: FormData) {
  const fullName = (formData.get("fullName") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!fullName || !email || !password) {
    throw new Error("Заполните все поля");
  }
  if (password.length < 6) {
    throw new Error("Пароль должен быть не короче 6 символов");
  }
  if (password !== confirmPassword) {
    throw new Error("Пароли не совпадают");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Пользователь с таким email уже зарегистрирован");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      systemRole: SystemRole.СОТРУДНИК,
      userType: UserType.ШТАТНЫЙ,
    },
  });
}
