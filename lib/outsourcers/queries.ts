import { prisma } from "@/lib/prisma";

export type OutsourcerListItem = {
  id: string;
  organization: string;
  specialization: string;
  phone: string;
  email: string;
  directorName: string;
  contractNumber: string | null;
};

// Проектов подрядчикам пока никто не назначает (нет такого флоу) —
// поэтому "N проектов" в карточке организации всегда 0, честно.
export async function getOutsourcers(): Promise<OutsourcerListItem[]> {
  const outsourcers = await prisma.outsourcer.findMany({
    orderBy: { organization: "asc" },
  });

  return outsourcers.map((outsourcer) => ({
    id: outsourcer.id,
    organization: outsourcer.organization,
    specialization: outsourcer.specialization,
    phone: outsourcer.phone,
    email: outsourcer.email,
    directorName: outsourcer.directorName,
    contractNumber: outsourcer.contractNumber,
  }));
}

export async function getOutsourcerById(id: string) {
  return prisma.outsourcer.findUnique({ where: { id } });
}
