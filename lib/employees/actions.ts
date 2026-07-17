"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { SystemRole, UserType } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Добавлять сотрудников может только РУКОВОДИТЕЛЬ — управление
// персоналом это его зона ответственности (см. бриф).
export async function createEmployeeAction(formData: FormData) {
  const session = await auth();
  if (session?.user.systemRole !== SystemRole.РУКОВОДИТЕЛЬ) {
    throw new Error("Недостаточно прав");
  }

  const fullName = (formData.get("fullName") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;
  const systemRole = formData.get("systemRole") as SystemRole | null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const position = (formData.get("position") as string | null)?.trim() || null;
  const birthDateRaw = formData.get("birthDate") as string | null;
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;

  const salaryRaw = (formData.get("salary") as string | null)?.trim();
  let salary: number | null = null;
  if (salaryRaw) {
    salary = Number(salaryRaw);
    if (Number.isNaN(salary) || salary <= 0) {
      throw new Error("Оклад должен быть положительным числом");
    }
  }

  if (!fullName || !email || !password) {
    throw new Error("Заполните все обязательные поля");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Сотрудник с таким email уже существует");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      systemRole: systemRole ?? SystemRole.СОТРУДНИК,
      userType: UserType.ШТАТНЫЙ,
      phone,
      position,
      birthDate,
      salary,
    },
  });

  revalidatePath("/employees");
  revalidatePath("/projects");
}

function isSelfOrHead(sessionUser: { id: string; systemRole: SystemRole }, targetUserId: string) {
  return sessionUser.id === targetUserId || sessionUser.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
}

// Контактные данные (email/телефон) — их может менять сам сотрудник в
// своём кабинете или руководитель (в чужом). Остальные, "кадровые",
// поля — только руководитель, см. updateEmployeeDetailsAction.
export async function updateEmployeeContactAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId || !isSelfOrHead(session.user, userId)) {
    throw new Error("Недостаточно прав");
  }

  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string | null)?.trim() || null;

  if (!email) {
    throw new Error("Email обязателен");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    throw new Error("Этот email уже используется другим сотрудником");
  }

  await prisma.user.update({ where: { id: userId }, data: { email, phone } });

  revalidatePath(`/employees/${userId}`);
  revalidatePath("/employees");
}

// ФИО/должность/оклад/системная роль — кадровые данные, редактирует
// только руководитель (даже в собственном кабинете сотрудник их не трогает).
export async function updateEmployeeDetailsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.systemRole !== SystemRole.РУКОВОДИТЕЛЬ) {
    throw new Error("Недостаточно прав");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId) {
    throw new Error("Не указан сотрудник");
  }

  const fullName = (formData.get("fullName") as string | null)?.trim();
  const position = (formData.get("position") as string | null)?.trim() || null;
  const birthDateRaw = formData.get("birthDate") as string | null;
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;
  const systemRole = formData.get("systemRole") as SystemRole | null;

  if (!fullName) {
    throw new Error("ФИО обязательно");
  }

  const salaryRaw = (formData.get("salary") as string | null)?.trim();
  let salary: number | null = null;
  if (salaryRaw) {
    salary = Number(salaryRaw);
    if (Number.isNaN(salary) || salary <= 0) {
      throw new Error("Оклад должен быть положительным числом");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      fullName,
      position,
      birthDate,
      salary,
      systemRole: systemRole ?? undefined,
    },
  });

  revalidatePath(`/employees/${userId}`);
  revalidatePath("/employees");
}

// Сам сотрудник обязан подтвердить текущий пароль (проверка личности).
// Руководитель, сбрасывающий пароль ДРУГОГО сотрудника, текущий пароль
// не знает и не должен вводить — это административный сброс.
export async function changePasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId || !isSelfOrHead(session.user, userId)) {
    throw new Error("Недостаточно прав");
  }

  const newPassword = formData.get("newPassword") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Пароль должен быть не короче 6 символов");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("Пароли не совпадают");
  }

  const isSelf = session.user.id === userId;
  if (isSelf) {
    const currentPassword = formData.get("currentPassword") as string | null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("Пользователь не найден");
    }
    const matches = currentPassword
      ? await bcrypt.compare(currentPassword, user.passwordHash)
      : false;
    if (!matches) {
      throw new Error("Текущий пароль указан неверно");
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath(`/employees/${userId}`);
}
