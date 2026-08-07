import { SystemRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
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
import { formatTodayLabel } from "@/lib/utils";

import { EmployeesManagersSwitcher } from "./section-switcher";

const KNOWN_TABS = new Set(["employees", "managers"]);

// Объединённая точка входа "Сотрудники" + "Руководители" (2026-08-07, по
// прямой просьбе — в сайдбаре остаётся только один пункт "Сотрудники").
// Оба списка — ровно те же данные и та же логика доступа, что раньше жили
// на отдельных страницах /employees и /managers (те роуты остаются
// рабочими сами по себе, просто без ссылки в меню) — здесь объединена
// только точка входа. Переключатель — components/section-switcher.tsx,
// две крупные плитки-кнопки; при заходе без ?tab= список не показывается
// вообще, пока не кликнуть по одной из плиток (см. initialView ниже).
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
  const initialView = tab && KNOWN_TABS.has(tab) ? (tab as "employees" | "managers") : null;

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
        <EmployeesManagersSwitcher
          initialView={initialView}
          employees={employees}
          canAddEmployees={canAddEmployees}
          isAdmin={isAdmin}
          positions={positions}
          chiefTechnicalDirectors={chiefTechnicalDirectors}
          managers={managers}
          departments={departments}
          employeeCandidates={employeeCandidates}
          isManagersAdmin={isManagersAdmin}
          managerPositions={managerPositions}
          gipPickerProjects={gipPickerProjects}
        />
      </div>
    </>
  );
}
