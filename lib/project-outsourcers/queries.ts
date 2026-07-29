import { prisma } from "@/lib/prisma";

export type ProjectOutsourcerItem = {
  id: string;
  outsourcerId: string;
  organization: string;
  specialization: string;
  functionNames: string[];
  addedByName: string;
  createdAt: Date;
  contractNumber: string | null;
  projectSubject: string | null;
  totalAmount: number | null;
  paymentPercent1: number | null;
  paymentPercent2: number | null;
  paymentPercent3: number | null;
  tranche1Paid: boolean;
  tranche2Paid: boolean;
  tranche3Paid: boolean;
};

// Для страницы проекта — все аутсорсеры, привязанные к нему, с траншами
// и отметкой, кто из бухгалтеров/админов их добавил (см. запрос Камилы:
// "руководитель департамента видит что бухгалтер добавила аутсорсера").
export async function getProjectOutsourcers(projectId: string): Promise<ProjectOutsourcerItem[]> {
  const rows = await prisma.projectOutsourcer.findMany({
    where: { projectId },
    include: {
      outsourcer: {
        select: {
          organization: true,
          specialization: true,
          functions: { select: { name: true } },
        },
      },
      addedByUser: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    outsourcerId: row.outsourcerId,
    organization: row.outsourcer.organization,
    specialization: row.outsourcer.specialization,
    functionNames: row.outsourcer.functions.map((f) => f.name),
    addedByName: row.addedByUser.fullName,
    createdAt: row.createdAt,
    contractNumber: row.contractNumber,
    projectSubject: row.projectSubject,
    totalAmount: row.totalAmount ? Number(row.totalAmount) : null,
    paymentPercent1: row.paymentPercent1,
    paymentPercent2: row.paymentPercent2,
    paymentPercent3: row.paymentPercent3,
    tranche1Paid: row.tranche1Paid,
    tranche2Paid: row.tranche2Paid,
    tranche3Paid: row.tranche3Paid,
  }));
}

// Для страницы аутсорсера — на каких проектах он занят (см. запрос Камилы:
// "у этого аутсорсера может быть несколько проектов").
export async function getOutsourcerProjectEngagements(outsourcerId: string) {
  const rows = await prisma.projectOutsourcer.findMany({
    where: { outsourcerId },
    include: { project: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project.id,
    projectName: row.project.name,
    projectStatus: row.project.status,
    contractNumber: row.contractNumber,
    totalAmount: row.totalAmount ? Number(row.totalAmount) : null,
  }));
}

// Для пикера "добавить аутсорсера" на странице проекта — уже существующие
// аутсорсеры компании, НЕ форма создания нового (по прямой просьбе
// Камилы: "не нового аутсорсера, а перечисленных, которых ранее создали").
export type OutsourcerPickerItem = { id: string; organization: string; specialization: string };

export async function getOutsourcersForPicker(): Promise<OutsourcerPickerItem[]> {
  return prisma.outsourcer.findMany({
    select: { id: true, organization: true, specialization: true },
    orderBy: { organization: "asc" },
  });
}
