import { SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUserRoleTier } from "@/lib/departments/queries";
import { getEmployees } from "@/lib/employees/queries";
import { getPositions } from "@/lib/positions/queries";
import { formatTodayLabel } from "@/lib/utils";

import { EmployeesExplorer } from "./employees-explorer";
import { NewEmployeeDialog } from "./new-employee-dialog";

export default async function EmployeesPage() {
  const [session, employees, positions] = await Promise.all([auth(), getEmployees(), getPositions()]);
  const roleTier = await getCurrentUserRoleTier(session?.user);

  // Руководитель департамента тоже может добавлять сотрудников — но только
  // в свой департамент (см. lib/employees/actions.ts::createEmployeeAction).
  const isAdmin = session?.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const canAddEmployees = isAdmin || roleTier === "department_manager";

  return (
    <>
      <PageHeader
        title="Сотрудники"
        subtitle={formatTodayLabel(new Date())}
        action={canAddEmployees ? <NewEmployeeDialog isAdmin={isAdmin} positions={positions} /> : undefined}
      />
      <div className="p-8">
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Сотрудников пока нет.</p>
        ) : (
          <EmployeesExplorer employees={employees} />
        )}
      </div>
    </>
  );
}
