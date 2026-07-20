"use server";

import { revalidatePath } from "next/cache";
import { AvrStage, ContractStatus, PaymentStatus, PaymentType, Prisma, ProjectRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/projects/permissions";

const round2 = (value: number) => Math.round(value * 100) / 100;

async function getPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw new Error("Платёж не найден");
  }
  return payment;
}

// Право на управление платежами/договором — операционная часть, только
// РУКОВОДИТЕЛЬ (см. lib/projects/permissions.ts).
export async function setPaymentDueDateAction(paymentId: string, dueDate: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Недостаточно прав для изменения срока платежа");
  }

  await getPayment(paymentId);

  await prisma.payment.update({
    where: { id: paymentId },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  });

  revalidatePath("/contracts");
  revalidatePath("/");
}

// Сумму транша можно скорректировать индивидуально уже после создания
// договора (напр. авто-сплит 40/40/20 из мастера проекта — только
// стартовая раскладка, не жёсткое ограничение). Сознательно не требуем,
// чтобы сумма трёх траншей продолжала совпадать с totalAmount договора
// после правки — это разовая ручная корректировка, а не пересборка
// графика; проверка "сумма = totalAmount" остаётся только при создании
// нового договора (см. createStandaloneContractAction).
export async function updatePaymentAmountAction(paymentId: string, amountRaw: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Недостаточно прав для изменения суммы платежа");
  }

  const amount = Number(amountRaw);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("Сумма платежа должна быть положительным числом");
  }

  await getPayment(paymentId);

  await prisma.payment.update({
    where: { id: paymentId },
    data: { amount: round2(amount) },
  });

  revalidatePath("/contracts");
  revalidatePath("/");
}

export async function togglePaymentPaidAction(paymentId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Недостаточно прав для отметки об оплате");
  }

  const payment = await getPayment(paymentId);

  const nextStatus =
    payment.status === PaymentStatus.ОПЛАЧЕНО
      ? PaymentStatus.ОЖИДАЕТСЯ
      : PaymentStatus.ОПЛАЧЕНО;

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: nextStatus,
      paidAt: nextStatus === PaymentStatus.ОПЛАЧЕНО ? new Date() : null,
    },
  });

  revalidatePath("/contracts");
  revalidatePath("/");
}

// Каскад вручную — как и в deleteProjectAction (lib/projects/actions.ts):
// в схеме нет onDelete: Cascade, а у договора есть свои зависимые записи
// (реквизиты, платежи, ЭЦП, закрывающие документы), которые Postgres не
// даст осиротить.
export async function deleteContractAction(contractId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Недостаточно прав для удаления договора");
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true },
  });
  if (!contract) {
    throw new Error("Договор не найден");
  }

  await prisma.$transaction(async (tx) => {
    await tx.closingDocument.deleteMany({ where: { contractId } });
    await tx.digitalSignature.deleteMany({ where: { contractId } });
    await tx.requisites.deleteMany({ where: { contractId } });
    await tx.payment.deleteMany({ where: { contractId } });
    await tx.contract.delete({ where: { id: contractId } });
  });

  revalidatePath("/contracts");
  revalidatePath("/");
}

export async function updateContractStatusAction(contractId: string, status: ContractStatus) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Недостаточно прав для изменения статуса договора");
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true },
  });
  if (!contract) {
    throw new Error("Договор не найден");
  }

  await prisma.contract.update({ where: { id: contractId }, data: { status } });
  revalidatePath("/contracts");
}

export async function updateAvrStageAction(contractId: string, avrStage: AvrStage) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Недостаточно прав для изменения статуса АВР");
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true },
  });
  if (!contract) {
    throw new Error("Договор не найден");
  }

  await prisma.contract.update({ where: { id: contractId }, data: { avrStage } });
  revalidatePath("/contracts");
}

// Создатель договора должен быть ProjectMember (ссылка createdByMemberId),
// но руководитель, создающий договор по чужому проекту, может им не быть
// (он видит все проекты, но не обязательно состоит в них) — тот же приём,
// что и в createProjectAction: если ещё не участник, добавляем МЕНЕДЖЕРОМ.
async function ensureProjectMembership(
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
) {
  const existing = await tx.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (existing) return existing;

  return tx.projectMember.create({
    data: { projectId, userId, projectRole: ProjectRole.МЕНЕДЖЕР },
  });
}

// Ручной ввод сумм траншей (в отличие от авто-сплита 40/40/20 в мастере
// создания проекта, см. lib/projects/actions.ts) — здесь договор создаётся
// отдельно от проекта, суммы и сроки задаёт руководитель вручную.
export async function createStandaloneContractAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Недостаточно прав для создания договора");
  }

  const projectId = (formData.get("projectId") as string | null)?.trim();
  const clientName = (formData.get("clientName") as string | null)?.trim();
  const number = (formData.get("number") as string | null)?.trim();
  const totalAmountRaw = (formData.get("totalAmount") as string | null)?.trim();

  if (!projectId || !clientName || !number || !totalAmountRaw) {
    throw new Error("Заполните все обязательные поля");
  }

  const totalAmount = Number(totalAmountRaw);
  if (Number.isNaN(totalAmount) || totalAmount <= 0) {
    throw new Error("Сумма договора должна быть положительным числом");
  }

  const tranches = [
    { key: "avans", amountRaw: formData.get("avansAmount"), dueDateRaw: formData.get("avansDueDate"), type: PaymentType.АВАНС },
    { key: "tranche2", amountRaw: formData.get("tranche2Amount"), dueDateRaw: formData.get("tranche2DueDate"), type: PaymentType.ТРАНШ_2 },
    { key: "tranche3", amountRaw: formData.get("tranche3Amount"), dueDateRaw: formData.get("tranche3DueDate"), type: PaymentType.ТРАНШ_3 },
  ].map(({ amountRaw, dueDateRaw, type }) => ({
    type,
    amount: Number((amountRaw as string | null)?.trim()),
    dueDate: dueDateRaw ? new Date(dueDateRaw as string) : null,
  }));

  if (tranches.some((t) => Number.isNaN(t.amount) || t.amount <= 0)) {
    throw new Error("Суммы траншей должны быть положительными числами");
  }

  const trancheSum = round2(tranches.reduce((sum, t) => sum + t.amount, 0));
  if (trancheSum !== round2(totalAmount)) {
    throw new Error(
      `Сумма траншей (${trancheSum.toLocaleString("ru-RU")}) не совпадает с суммой договора (${totalAmount.toLocaleString("ru-RU")})`,
    );
  }

  const providedDates = tranches.map((t) => t.dueDate).filter((d): d is Date => d !== null);
  for (let i = 1; i < providedDates.length; i++) {
    if (providedDates[i].getTime() < providedDates[i - 1].getTime()) {
      throw new Error("Сроки платежей должны идти по порядку: аванс → 2-й транш → 3-й транш");
    }
  }

  const bankName = (formData.get("bankName") as string | null)?.trim() || null;
  const accountNumber = (formData.get("accountNumber") as string | null)?.trim() || null;
  const bik = (formData.get("bik") as string | null)?.trim() || null;
  const binIin = (formData.get("binIin") as string | null)?.trim() || null;
  const hasRequisites = Boolean(bankName || accountNumber || bik || binIin);

  try {
    await prisma.$transaction(async (tx) => {
      const creatorMember = await ensureProjectMembership(tx, projectId, session.user.id);

      const contract = await tx.contract.create({
        data: {
          projectId,
          createdByMemberId: creatorMember.id,
          number,
          clientName,
          totalAmount,
        },
      });

      if (hasRequisites) {
        await tx.requisites.create({
          data: { contractId: contract.id, bankName, accountNumber, bik, binIin },
        });
      }

      await tx.payment.createMany({
        data: tranches.map((t) => ({
          contractId: contract.id,
          paymentType: t.type,
          amount: t.amount,
          dueDate: t.dueDate,
        })),
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Договор с таким номером уже существует");
    }
    throw error;
  }

  revalidatePath("/contracts");
  revalidatePath("/");
}
