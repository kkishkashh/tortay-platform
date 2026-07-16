import { UserType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// ГИП — руководящая роль внутри компании, поэтому выбираем только
// штатных сотрудников (аутсорсеров сюда не включаем).
export async function getEmployeesForSelect() {
  return prisma.user.findMany({
    where: { userType: UserType.ШТАТНЫЙ },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

// Полный список для страницы "Сотрудники" — с полями для таблицы,
// а не только id+имя, как в getEmployeesForSelect() для дропдауна.
export async function getEmployees() {
  return prisma.user.findMany({
    where: { userType: UserType.ШТАТНЫЙ },
    select: {
      id: true,
      fullName: true,
      email: true,
      systemRole: true,
      phone: true,
      position: true,
      createdAt: true,
    },
    orderBy: { fullName: "asc" },
  });
}
