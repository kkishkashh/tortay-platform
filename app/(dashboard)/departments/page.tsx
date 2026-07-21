import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { canManageDepartments } from "@/lib/departments/permissions";
import { getCurrentUserRoleTier, getDepartments } from "@/lib/departments/queries";
import { formatTodayLabel } from "@/lib/utils";

import { DepartmentCard } from "./department-card";
import { NewDepartmentDialog } from "./new-department-dialog";

export default async function DepartmentsPage() {
  const session = await auth();

  // Тот же уровень доступа, что и у страницы департамента ([id]/page.tsx):
  // список департаментов — тоже не для рядового сотрудника (см. бриф,
  // "No departments" в Employee Dashboard), а не только пункт меню скрыт.
  const roleTier = await getCurrentUserRoleTier(session?.user);
  if (roleTier === "employee") {
    redirect("/");
  }

  const departments = await getDepartments();
  const canCreate = session?.user ? canManageDepartments(session.user) : false;

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
              <DepartmentCard key={department.id} department={department} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
