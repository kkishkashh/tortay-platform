import { AvrStage, ContractStatus, PaymentStatus, PaymentType } from "@prisma/client";

import { auth } from "@/auth";
import { PAYMENT_TYPE_LABELS } from "@/lib/contracts/labels";
import { prisma } from "@/lib/prisma";
import { canManageFinance } from "@/lib/projects/permissions";

export type ContractPayment = {
  id: string;
  paymentType: PaymentType;
  amount: number;
  status: PaymentStatus;
  dueDate: Date | null;
  paidAt: Date | null;
};

export type ContractListItem = {
  id: string;
  number: string;
  clientName: string;
  totalAmount: number;
  paidAmount: number;
  status: ContractStatus;
  avrStage: AvrStage;
  projectId: string;
  projectName: string;
  payments: ContractPayment[];
  requisites: {
    bankName: string | null;
    accountNumber: string | null;
    bik: string | null;
    binIin: string | null;
  } | null;
};

// Договоры — финансово-кадровая зона: руководитель компании и руководитель
// Административного департамента (canManageFinance) видят все договоры
// компании, остальные — только по проектам, где сами участники (на случай,
// если сюда попадёт кто-то за пределами страницы /contracts, которая и так
// закрыта тем же правом).
// Реквизиты подтягиваются сразу вместе со списком (не отдельным запросом
// при открытии карточки) — датасет для внутреннего инструмента небольшой.
export async function getContractsForCurrentUser(): Promise<ContractListItem[]> {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  const seesAll = await canManageFinance(session.user);

  const contracts = await prisma.contract.findMany({
    where: seesAll
      ? undefined
      : { project: { members: { some: { userId: session.user.id } } } },
    include: {
      project: { select: { id: true, name: true } },
      payments: { orderBy: { paymentType: "asc" } },
      requisites: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return contracts.map((contract) => {
    const payments = contract.payments.map((payment) => ({
      id: payment.id,
      paymentType: payment.paymentType,
      amount: Number(payment.amount),
      status: payment.status,
      dueDate: payment.dueDate,
      paidAt: payment.paidAt,
    }));

    return {
      id: contract.id,
      number: contract.number,
      clientName: contract.clientName,
      totalAmount: Number(contract.totalAmount),
      paidAmount: payments
        .filter((payment) => payment.status === PaymentStatus.ОПЛАЧЕНО)
        .reduce((sum, payment) => sum + payment.amount, 0),
      status: contract.status,
      avrStage: contract.avrStage,
      projectId: contract.project.id,
      projectName: contract.project.name,
      payments,
      requisites: contract.requisites
        ? {
            bankName: contract.requisites.bankName,
            accountNumber: contract.requisites.accountNumber,
            bik: contract.requisites.bik,
            binIin: contract.requisites.binIin,
          }
        : null,
    };
  });
}

// Для дропдауна в форме "Новый договор" — тот же скоуп видимости.
export async function getProjectsForContractSelect() {
  const session = await auth();
  if (!session?.user) return [];

  const seesAll = await canManageFinance(session.user);

  return prisma.project.findMany({
    where: seesAll ? undefined : { members: { some: { userId: session.user.id } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type ContractSummaryStage = {
  // "СЧЁТ" — не реальный PaymentType, а первая ступень прогресс-бара:
  // сам факт существования договора (см. ниже, всегда isDone: true).
  key: "СЧЁТ" | PaymentType;
  label: string;
  isDone: boolean;
};

export type ContractSummary = {
  contractId: string;
  number: string;
  status: ContractStatus;
  avrStage: AvrStage;
  percentPaid: number;
  stages: ContractSummaryStage[];
};

// Task 3.1/3.3 (PRD #3 Phase 4) — краткая, БЕЗ сумм и реквизитов, карточка
// договора для страницы проекта: видна любому, кто вообще видит проект
// (та же логика видимости, что и у ProjectOutsourcersSection), в отличие
// от полной карточки на /contracts (там суммы/реквизиты/ЭЦП, доступ
// только canManageFinance). Один проект — один активный договор в
// текущей модели, поэтому просто самый свежий.
export async function getContractSummaryForProject(projectId: string): Promise<ContractSummary | null> {
  const contract = await prisma.contract.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      status: true,
      avrStage: true,
      totalAmount: true,
      payments: { select: { paymentType: true, amount: true, status: true } },
    },
  });
  if (!contract) return null;

  const totalAmount = Number(contract.totalAmount);
  const paidAmount = contract.payments
    .filter((p) => p.status === PaymentStatus.ОПЛАЧЕНО)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const percentPaid = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  const paymentByType = new Map(contract.payments.map((p) => [p.paymentType, p]));
  const trancheStages: ContractSummaryStage[] = [
    PaymentType.АВАНС,
    PaymentType.ТРАНШ_2,
    PaymentType.ТРАНШ_3,
  ]
    .filter((type) => paymentByType.has(type))
    .map((type) => ({
      key: type,
      label: PAYMENT_TYPE_LABELS[type],
      isDone: paymentByType.get(type)!.status === PaymentStatus.ОПЛАЧЕНО,
    }));

  return {
    contractId: contract.id,
    number: contract.number,
    status: contract.status,
    avrStage: contract.avrStage,
    percentPaid,
    stages: [{ key: "СЧЁТ", label: "Счёт", isDone: true }, ...trancheStages],
  };
}

// Только подсказка для поля номера в форме создания — редактируемая,
// уникальность проверяется отдельно на сервере при сохранении.
export async function suggestContractNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.contract.count({
    where: {
      createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
  });
  return `ДОГ-${year}-${String(count + 1).padStart(3, "0")}`;
}
