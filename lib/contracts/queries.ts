import { AvrStage, ContractStatus, PaymentStatus, PaymentType, SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

// Та же зона видимости, что и у списка проектов: РУКОВОДИТЕЛЬ видит все
// договоры компании, СОТРУДНИК — только по проектам, где сам участник.
// Реквизиты подтягиваются сразу вместе со списком (не отдельным запросом
// при открытии карточки) — датасет для внутреннего инструмента небольшой.
export async function getContractsForCurrentUser(): Promise<ContractListItem[]> {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

  const contracts = await prisma.contract.findMany({
    where: isHead
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

  const isHead = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

  return prisma.project.findMany({
    where: isHead ? undefined : { members: { some: { userId: session.user.id } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
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
