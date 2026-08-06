import { SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isFullAdmin } from "@/lib/auth/roles";
import { getCurrentUserRoleTier } from "@/lib/departments/queries";
import { getCompanyWideEmployees, getEmployees } from "@/lib/employees/queries";
import { getPositions } from "@/lib/positions/queries";
import { formatTodayLabel } from "@/lib/utils";

import { EmployeesExplorer } from "./employees-explorer";
import { NewEmployeeDialog } from "./new-employee-dialog";

export default async function EmployeesPage() {
  const session = await auth();
  const roleTier = await getCurrentUserRoleTier(session?.user);

  // Руководитель департамента тоже может добавлять сотрудников — но только
  // в свой департамент (см. lib/employees/actions.ts::createEmployeeAction).
  // isAdmin здесь — строго АДМИН: gates смену системной роли в форме
  // создания (NewEmployeeDialog), это остаётся исключительно у него.
  // canAddEmployees — шире: АДМИН, РУКОВОДИТЕЛЬ (обе — операционные роли,
  // см. lib/projects/permissions.ts) или руководитель департамента.
  const isAdmin = !!session?.user && isFullAdmin(session.user.systemRole);
  const isElevated =
    isAdmin || session?.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ || !!session?.user.isGip;
  const canAddEmployees = isElevated || roleTier === "department_manager";

  // Task 2.1/2.2 (PRD #3 Phase 5) — "Вся компания" только для руководителей
  // департаментов (не рядовых сотрудников, см. project-prd3 memory: это
  // деление сознательно НЕ трогаем для employee-уровня). Админ и так видит
  // всех через обычный getEmployees(), вторая вкладка ему не нужна.
  const showCompanyWideTab = roleTier === "department_manager";

  const [employees, companyWideEmployees, positions] = await Promise.all([
    getEmployees(),
    showCompanyWideTab ? getCompanyWideEmployees() : Promise.resolve([]),
    getPositions(),
  ]);

  return (
    <>
      <PageHeader
        title="Сотрудники"
        subtitle={formatTodayLabel(new Date())}
        action={canAddEmployees ? <NewEmployeeDialog isAdmin={isAdmin} positions={positions} /> : undefined}
      />
      <div className="p-8">
        {showCompanyWideTab ? (
          <Tabs defaultValue="mine">
            <TabsList>
              <TabsTrigger value="mine">Мой отдел</TabsTrigger>
              <TabsTrigger value="company">Вся компания</TabsTrigger>
            </TabsList>
            <TabsContent value="mine" className="mt-4">
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">Сотрудников пока нет.</p>
              ) : (
                <EmployeesExplorer employees={employees} />
              )}
            </TabsContent>
            <TabsContent value="company" className="mt-4">
              {companyWideEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">Сотрудников пока нет.</p>
              ) : (
                <EmployeesExplorer employees={companyWideEmployees} />
              )}
            </TabsContent>
          </Tabs>
        ) : employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Сотрудников пока нет.</p>
        ) : (
          <EmployeesExplorer employees={employees} />
        )}
      </div>
    </>
  );
}
