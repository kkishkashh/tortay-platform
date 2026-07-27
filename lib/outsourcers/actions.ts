"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageFinance } from "@/lib/projects/permissions";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Казахстанский формат: +7 и 10 цифр (код города/оператора + номер),
// разделители (пробелы/скобки/дефисы) не важны.
function isValidKazakhstanPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return /^7\d{10}$/.test(digits);
}

// Добавлять подрядчиков может руководитель компании либо руководитель
// Административного департамента (см. lib/projects/permissions.ts,
// canManageFinance).
export async function createOutsourcerAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
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

// Данные для автогенерации договора подряда (см. lib/outsourcers/contract-docx.ts) —
// заполняются на странице аутсорсера отдельно от быстрой карточки создания.
// Номер и дата договора генерируются автоматически при первом сохранении,
// если ещё не заданы — дальше не меняются даже при повторном сохранении
// формы, чтобы не переносить дату уже заключённого договора.
export async function updateOutsourcerContractDetailsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    throw new Error("Недостаточно прав");
  }

  const id = formData.get("id") as string;
  const iin = (formData.get("iin") as string | null)?.trim();
  const address = (formData.get("address") as string | null)?.trim();
  const bankName = (formData.get("bankName") as string | null)?.trim();
  const bankKbe = (formData.get("bankKbe") as string | null)?.trim();
  const bankAccountNumber = (formData.get("bankAccountNumber") as string | null)?.trim();
  const bankBik = (formData.get("bankBik") as string | null)?.trim();
  const idCardNumber = (formData.get("idCardNumber") as string | null)?.trim();
  const idCardIssuedAtRaw = formData.get("idCardIssuedAt") as string | null;
  const idCardIssuedBy = (formData.get("idCardIssuedBy") as string | null)?.trim();
  const projectSubject = (formData.get("projectSubject") as string | null)?.trim();
  const durationDaysRaw = (formData.get("durationDays") as string | null)?.trim();
  const totalAmountRaw = (formData.get("totalAmount") as string | null)?.trim();
  const paymentPercent1Raw = (formData.get("paymentPercent1") as string | null)?.trim();
  const paymentPercent2Raw = (formData.get("paymentPercent2") as string | null)?.trim();
  const paymentPercent3Raw = (formData.get("paymentPercent3") as string | null)?.trim();

  if (
    !id || !iin || !address || !bankName || !bankKbe || !bankAccountNumber || !bankBik ||
    !idCardNumber || !idCardIssuedAtRaw || !idCardIssuedBy || !projectSubject ||
    !durationDaysRaw || !totalAmountRaw
  ) {
    throw new Error("Заполните все поля договора");
  }

  const durationDays = Number(durationDaysRaw);
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    throw new Error("Некорректный срок выполнения работ");
  }

  const totalAmount = Number(totalAmountRaw);
  if (Number.isNaN(totalAmount) || totalAmount <= 0) {
    throw new Error("Некорректная стоимость работ");
  }

  const paymentPercent1 = paymentPercent1Raw ? Number(paymentPercent1Raw) : 60;
  const paymentPercent2 = paymentPercent2Raw ? Number(paymentPercent2Raw) : 20;
  const paymentPercent3 = paymentPercent3Raw ? Number(paymentPercent3Raw) : 20;
  for (const [label, value] of [
    ["Первый транш", paymentPercent1],
    ["Второй транш", paymentPercent2],
    ["Третий транш", paymentPercent3],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error(`${label} оплаты должен быть от 0 до 100`);
    }
  }
  if (paymentPercent1 + paymentPercent2 + paymentPercent3 !== 100) {
    throw new Error("Сумма процентов по всем траншам должна быть равна 100");
  }

  const existing = await prisma.outsourcer.findUnique({
    where: { id },
    select: { contractNumber: true, contractDate: true },
  });
  if (!existing) {
    throw new Error("Аутсорсер не найден");
  }

  let contractNumber = existing.contractNumber;
  if (!contractNumber) {
    const year = new Date().getFullYear();
    const countThisYear = await prisma.outsourcer.count({
      where: { contractNumber: { startsWith: `ДОГ-АУТ-${year}-` } },
    });
    contractNumber = `ДОГ-АУТ-${year}-${String(countThisYear + 1).padStart(3, "0")}`;
  }
  const contractDate = existing.contractDate ?? new Date();

  try {
    await prisma.outsourcer.update({
      where: { id },
      data: {
        iin,
        address,
        bankName,
        bankKbe,
        bankAccountNumber,
        bankBik,
        idCardNumber,
        idCardIssuedAt: new Date(idCardIssuedAtRaw),
        idCardIssuedBy,
        projectSubject,
        durationDays,
        totalAmount,
        paymentPercent1,
        paymentPercent2,
        paymentPercent3,
        contractNumber,
        contractDate,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Договор с таким номером уже зарегистрирован");
    }
    throw error;
  }

  revalidatePath(`/outsourcers/${id}`);
}

// Outsourcer — самостоятельная запись без внешних ключей на другие
// таблицы (см. schema.prisma), поэтому удаление простое, без каскада.
export async function deleteOutsourcerAction(id: string) {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    throw new Error("Недостаточно прав");
  }

  await prisma.outsourcer.delete({ where: { id } });

  revalidatePath("/outsourcers");
  redirect("/outsourcers");
}
