import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ManagersTab } from "@/components/employees/managers-tab";
import { canManageDepartments } from "@/lib/departments/permissions";
import { getDepartments, getEmployeesForManagerAssignment } from "@/lib/departments/queries";
import { getManagers } from "@/lib/managers/queries";
import { getPositions } from "@/lib/positions/queries";
import { getProjectsForGipPicker } from "@/lib/projects/queries";
import { formatTodayLabel } from "@/lib/utils";

// Отдельный раздел (не таб в Account Portal). Список видят все сотрудники
// (по просьбе Камилы — "сотрудник видит только названия других
// департаментов", а руководителей полезно видеть всем), но создавать/
// редактировать/удалять руководителей и сбрасывать им пароль может
// только администратор (canManageDepartments) — см. isAdmin ниже и
// серверные проверки в lib/managers/actions.ts, которые это дублируют.
export default async function ManagersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const isAdmin = canManageDepartments(session.user);

  const [managers, departments, employeeCandidates, positions, gipPickerProjects] = await Promise.all([
    getManagers(),
    getDepartments(),
    // Только админу — тот же список, что и на странице департамента, для
    // пикера "Назначить руководителя" (см. lib/departments/queries.ts::
    // getEmployeesForManagerAssignment: без этого RSC-payload утекал бы
    // компании целиком не-админам).
    isAdmin ? getEmployeesForManagerAssignment() : Promise.resolve([]),
    // Для диалога "Убрать из руководителей" — там можно сразу поменять
    // должность и назначить ГИПом (см. remove-from-managers-dialog.tsx).
    isAdmin ? getPositions() : Promise.resolve([]),
    isAdmin ? getProjectsForGipPicker(session.user) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Руководители" subtitle={formatTodayLabel(new Date())} />
      <div className="p-8">
        <ManagersTab
          managers={managers}
          departments={departments}
          employeeCandidates={employeeCandidates}
          isAdmin={isAdmin}
          positions={positions}
          gipPickerProjects={gipPickerProjects}
        />
      </div>
    </>
  );
}
