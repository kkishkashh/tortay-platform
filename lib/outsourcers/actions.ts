"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Казахстанский формат: +7 и 10 цифр (код города/оператора + номер),
// разделители (пробелы/скобки/дефисы) не важны.
function isValidKazakhstanPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return /^7\d{10}$/.test(digits);
}

// Добавлять подрядчиков может только РУКОВОДИТЕЛЬ — та же зона
// ответственности, что и за сотрудников (см. createEmployeeAction).
export async function createOutsourcerAction(formData: FormData) {
  const session = await auth();
  if (session?.user.systemRole !== SystemRole.РУКОВОДИТЕЛЬ) {
    throw new Error("Недостаточно прав");
  }

  const organization = (formData.get("organization") as string | null)?.trim();
  const specialization = (formData.get("specialization") as string | null)?.trim();
  const phone = (formData.get("phone") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const directorName = (formData.get("directorName") as string | null)?.trim();
  const contractNumber = (formData.get("contractNumber") as string | null)?.trim() || null;

  if (!organization || !specialization || !phone || !email || !directorName) {
    throw new Error("Заполните все обязательные поля");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Некорректный email");
  }

  if (!isValidKazakhstanPhone(phone)) {
    throw new Error("Некорректный номер телефона (формат Казахстана: +7 ...)");
  }

  try {
    await prisma.outsourcer.create({
      data: { organization, specialization, phone, email, directorName, contractNumber },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Договор с таким номером уже зарегистрирован");
    }
    throw error;
  }

  revalidatePath("/outsourcers");
}

// Outsourcer — самостоятельная запись без внешних ключей на другие
// таблицы (см. schema.prisma), поэтому удаление простое, без каскада.
export async function deleteOutsourcerAction(id: string) {
  const session = await auth();
  if (session?.user.systemRole !== SystemRole.РУКОВОДИТЕЛЬ) {
    throw new Error("Недостаточно прав");
  }

  await prisma.outsourcer.delete({ where: { id } });

  revalidatePath("/outsourcers");
  redirect("/outsourcers");
}
