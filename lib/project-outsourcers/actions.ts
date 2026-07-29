"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageFinance } from "@/lib/projects/permissions";

// Тот же круг, что управляет аутсорсерами/договорами (см. canManageFinance) —
// привязать аутсорсера к проекту и выставить транши может бухгалтер или
// администратор, не руководитель департамента (тот только смотрит).
async function assertCanManage() {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    throw new Error("Недостаточно прав");
  }
  return session.user;
}

export type ProjectOutsourcerFormState = { error: string | null; successCount: number };

// Договор/номер здесь — отдельная нумерация от "ДОГ-АУТ-" (тот у самого
// Outsourcer, для его отдельного, не привязанного к проекту, договора) —
// "ДОГ-ПРО-" явно отличает "договор по конкретному проекту".
export async function addOutsourcerToProjectAction(
  prevState: ProjectOutsourcerFormState,
  formData: FormData,
): Promise<ProjectOutsourcerFormState> {
  let user;
  try {
    user = await assertCanManage();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Недостаточно прав", successCount: prevState.successCount };
  }

  const projectId = formData.get("projectId") as string | null;
  const outsourcerId = formData.get("outsourcerId") as string | null;
  const projectSubject = (formData.get("projectSubject") as string | null)?.trim() || null;
  const durationDaysRaw = (formData.get("durationDays") as string | null)?.trim();
  const totalAmountRaw = (formData.get("totalAmount") as string | null)?.trim();
  const paymentPercent1Raw = (formData.get("paymentPercent1") as string | null)?.trim();
  const paymentPercent2Raw = (formData.get("paymentPercent2") as string | null)?.trim();
  const paymentPercent3Raw = (formData.get("paymentPercent3") as string | null)?.trim();

  if (!projectId || !outsourcerId) {
    return { error: "Выберите аутсорсера", successCount: prevState.successCount };
  }

  const durationDays = durationDaysRaw ? Number(durationDaysRaw) : null;
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays <= 0)) {
    return { error: "Некорректный срок выполнения работ", successCount: prevState.successCount };
  }

  const totalAmount = totalAmountRaw ? Number(totalAmountRaw) : null;
  if (totalAmount !== null && (Number.isNaN(totalAmount) || totalAmount <= 0)) {
    return { error: "Некорректная стоимость работ", successCount: prevState.successCount };
  }

  const paymentPercent1 = paymentPercent1Raw ? Number(paymentPercent1Raw) : 60;
  const paymentPercent2 = paymentPercent2Raw ? Number(paymentPercent2Raw) : 20;
  const paymentPercent3 = paymentPercent3Raw ? Number(paymentPercent3Raw) : 20;
  for (const value of [paymentPercent1, paymentPercent2, paymentPercent3]) {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      return { error: "Проценты по траншам должны быть от 0 до 100", successCount: prevState.successCount };
    }
  }
  if (paymentPercent1 + paymentPercent2 + paymentPercent3 !== 100) {
    return { error: "Сумма процентов по всем траншам должна быть равна 100", successCount: prevState.successCount };
  }

  const year = new Date().getFullYear();
  const countThisYear = await prisma.projectOutsourcer.count({
    where: { contractNumber: { startsWith: `ДОГ-ПРО-${year}-` } },
  });
  const contractNumber = `ДОГ-ПРО-${year}-${String(countThisYear + 1).padStart(3, "0")}`;

  try {
    await prisma.projectOutsourcer.create({
      data: {
        projectId,
        outsourcerId,
        addedByUserId: user.id,
        projectSubject,
        durationDays,
        totalAmount,
        paymentPercent1,
        paymentPercent2,
        paymentPercent3,
        contractNumber,
        contractDate: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Этот аутсорсер уже привязан к проекту", successCount: prevState.successCount };
    }
    throw error;
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null, successCount: prevState.successCount + 1 };
}

export async function removeOutsourcerFromProjectAction(id: string) {
  await assertCanManage();

  const row = await prisma.projectOutsourcer.delete({ where: { id }, select: { projectId: true } });

  revalidatePath(`/projects/${row.projectId}`);
}

export async function toggleTranchePaidAction(id: string, tranche: 1 | 2 | 3) {
  await assertCanManage();

  const row = await prisma.projectOutsourcer.findUnique({
    where: { id },
    select: { projectId: true, tranche1Paid: true, tranche2Paid: true, tranche3Paid: true },
  });
  if (!row) {
    throw new Error("Запись не найдена");
  }

  const field = (`tranche${tranche}Paid` as const) satisfies "tranche1Paid" | "tranche2Paid" | "tranche3Paid";
  await prisma.projectOutsourcer.update({
    where: { id },
    data: { [field]: !row[field] },
  });

  revalidatePath(`/projects/${row.projectId}`);
}
