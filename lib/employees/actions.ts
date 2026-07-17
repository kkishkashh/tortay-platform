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
