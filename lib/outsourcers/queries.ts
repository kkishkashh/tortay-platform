import { prisma } from "@/lib/prisma";

export type OutsourcerListItem = {
  id: string;
  organization: string;
  specialization: string;
  phone: string;
  email: string;
  directorName: string;
  contractNumber: string | null;
  projectsCount: number;
};

export async function getOutsourcers(): Promise<OutsourcerListItem[]> {
  const outsourcers = await prisma.outsourcer.findMany({
    orderBy: { organization: "asc" },
    include: { _count: { select: { projectEngagements: true } } },
  });

  return outsourcers.map((outsourcer) => ({
    id: outsourcer.id,
    organization: outsourcer.organization,
    specialization: outsourcer.specialization,
    phone: outsourcer.phone,
    email: outsourcer.email,
    directorName: outsourcer.directorName,
    contractNumber: outsourcer.contractNumber,
    projectsCount: outsourcer._count.projectEngagements,
  }));
}

export async function getOutsourcerById(id: string) {
  return prisma.outsourcer.findUnique({
    where: { id },
    include: { functions: { select: { id: true, name: true } } },
  });
}
