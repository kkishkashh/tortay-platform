import { SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getEmployees } from "@/lib/employees/queries";
import { formatTodayLabel } from "@/lib/utils";

import { EmployeesExplorer } from "./employees-explorer";
import { NewEmployeeDialog } from "./new-employee-dialog";

export default async function EmployeesPage() {
  const [session, employees] = await Promise.all([auth(), getEmployees()]);

  const canAddEmployees = session?.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

  return (
    <>
      <PageHeader
        title="Сотрудники"
        subtitle={formatTodayLabel(new Date())}
        action={canAddEmployees ? <NewEmployeeDialog /> : undefined}
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
