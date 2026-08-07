import { SystemRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { UserCog, Users } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManagersTab } from "@/components/employees/managers-tab";
import { isFullAdmin } from "@/lib/auth/roles";
import { canManageDepartments } from "@/lib/departments/permissions";
import {
  getCurrentUserRoleTier,
  getDepartments,
  getEmployeesForManagerAssignment,
} from "@/lib/departments/queries";
import { getEmployees } from "@/lib/employees/queries";
import { getChiefTechnicalDirectors, getManagers } from "@/lib/managers/queries";
import { getPositions } from "@/lib/positions/queries";
import { getProjectsForGipPicker } from "@/lib/projects/queries";
import { cn, formatTodayLabel } from "@/lib/utils";

import { EmployeesExplorer } from "./employees-explorer";
import { NewEmployeeDialog } from "./new-employee-dialog";

const KNOWN_TABS = new Set(["employees", "managers"]);

const TILE_BASE =
  "group relative flex-col items-start gap-3 overflow-hidden rounded-xl bg-linear-to-br p-5 text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover opacity-70 data-active:opacity-100";

// Объединённая точка входа "Сотрудники" + "Руководители" (2026-08-07, по
// прямой просьбе — в сайдбаре остаётся только один пункт "Сотрудники").
// Обе вкладки — ровно те же данные и та же логика доступа, что раньше жили
// на отдельных страницах /employees и /managers (те роуты остаются
// рабочими сами по себе, просто без ссылки в меню) — здесь объединена
// только точка входа, переключатель оформлен как две крупные плитки вместо
// обычных мелких табов.
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { tab } = await searchParams;
  const initialTab = tab && KNOWN_TABS.has(tab) ? tab : "employees";

  const roleTier = await getCurrentUserRoleTier(session.user);

  // --- "Сотрудники" (было app/(dashboard)/employees/page.tsx) ---
  const isAdmin = isFullAdmin(session.user.systemRole);
  const isElevated =
    isAdmin || session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ || !!session.user.isProjectLead;
  const canAddEmployees = isElevated || roleTier === "department_manager";

  // --- "Руководители" (было app/(dashboard)/managers/page.tsx) ---
  const isManagersAdmin = canManageDepartments(session.user);

  const [
    employees,
    positions,
    chiefTechnicalDirectors,
    managers,
    departments,
    employeeCandidates,
    managerPositions,
    gipPickerProjects,
  ] = await Promise.all([
    getEmployees(),
    getPositions(),
    getChiefTechnicalDirectors(),
    getManagers(),
    getDepartments(),
    isManagersAdmin ? getEmployeesForManagerAssignment() : Promise.resolve([]),
    isManagersAdmin ? getPositions() : Promise.resolve([]),
    isManagersAdmin ? getProjectsForGipPicker(session.user) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Сотрудники" subtitle={formatTodayLabel(new Date())} />
      <div className="space-y-6 p-8">
        <Tabs defaultValue={initialTab}>
          <TabsList className="grid h-auto w-full grid-cols-1 gap-4 bg-transparent p-0 sm:grid-cols-2">
            <TabsTrigger value="employees" className={cn(TILE_BASE, "from-[#16a34a] to-[#0d7a37]")}>
              <div className="relative flex w-full items-center justify-between gap-2">
                <span className="text-sm font-medium text-white/80">Сотрудники</span>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <Users className="size-4.5" />
                </div>
              </div>
              <p className="relative text-3xl font-semibold tracking-tight">{employees.length}</p>
            </TabsTrigger>
            <TabsTrigger value="managers" className={cn(TILE_BASE, "from-[#f0ac3d] to-[#c47a12]")}>
              <div className="relative flex w-full items-center justify-between gap-2">
                <span className="text-sm font-medium text-white/80">Руководители</span>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <UserCog className="size-4.5" />
                </div>
              </div>
              <p className="relative text-3xl font-semibold tracking-tight">{managers.length}</p>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="mt-6">
            {canAddEmployees ? (
              <div className="mb-4 flex justify-end">
                <NewEmployeeDialog isAdmin={isAdmin} positions={positions} />
              </div>
            ) : null}
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Сотрудников пока нет.</p>
            ) : (
              <EmployeesExplorer employees={employees} />
            )}
          </TabsContent>

          <TabsContent value="managers" className="mt-6">
            <ManagersTab
              chiefTechnicalDirectors={chiefTechnicalDirectors}
              managers={managers}
              departments={departments}
              employeeCandidates={employeeCandidates}
              isAdmin={isManagersAdmin}
              positions={managerPositions}
              gipPickerProjects={gipPickerProjects}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
