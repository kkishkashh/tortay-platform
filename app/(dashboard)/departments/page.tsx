import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { canManageDepartments } from "@/lib/departments/permissions";
import { getCurrentUserRoleTier, getDepartments } from "@/lib/departments/queries";
import { prisma } from "@/lib/prisma";
import { formatTodayLabel } from "@/lib/utils";

import { DepartmentCard } from "./department-card";
import { NewDepartmentDialog } from "./new-department-dialog";

export default async function DepartmentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Рядовой сотрудник видит страницу, но только НАЗВАНИЯ департаментов —
  // без состава/статистики/руководителя и без перехода на страницу
  // департамента (та по-прежнему доступна только руководителю/админу, см.
  // [id]/page.tsx). Раньше сотрудника сюда не пускали вовсе — по прямой
  // просьбе Камилы это открыли (см. описание 3 ролей). Исключение
  // (2026-08-06): Ведущий архитектор — своя карточка департамента (где у
  // него есть блок) кликабельна, чужие — по-прежнему только название.
  const roleTier = await getCurrentUserRoleTier(session.user);
  const nameOnly = roleTier === "employee";
  const currentUser = nameOnly
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { leadOfManagerId: true, homeDepartmentId: true },
      })
    : null;
  const leadDepartmentId = currentUser?.leadOfManagerId ? currentUser.homeDepartmentId : null;

  const departments = await getDepartments();
  const canCreate = canManageDepartments(session.user);

  return (
    <>
      <PageHeader
        title="Департаменты"
        subtitle={formatTodayLabel(new Date())}
        action={canCreate ? <NewDepartmentDialog /> : undefined}
      />
      <div className="p-8">
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Департаментов пока нет.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {departments.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                nameOnly={nameOnly && department.id !== leadDepartmentId}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
