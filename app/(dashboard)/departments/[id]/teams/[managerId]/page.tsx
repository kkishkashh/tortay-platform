import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { canManageDepartment } from "@/lib/departments/permissions";
import { getCurrentUserRoleTier, getDepartmentById } from "@/lib/departments/queries";
import { getDepartmentHierarchy } from "@/lib/leads/queries";
import { getActiveTasksForUsers } from "@/lib/tasks/queries";

import { TeamDetailView } from "./team-detail-view";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string; managerId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id, managerId } = await params;
  const department = await getDepartmentById(id);
  if (!department) {
    notFound();
  }

  // Тот же доступ, что и у самой страницы департамента (см.
  // app/(dashboard)/departments/[id]/page.tsx) — это её под-страница.
  const canManageDept = canManageDepartment(session.user, department);
  const roleTier = await getCurrentUserRoleTier(session.user);
  const canView = canManageDept || roleTier === "department_manager";
  if (!canView) {
    redirect("/");
  }

  const hierarchy = await getDepartmentHierarchy(id);
  const manager = hierarchy.managers.find((m) => m.id === managerId);
  if (!manager) {
    notFound();
  }

  // Все сотрудники команды этого руководителя (сами Лиды + их команды +
  // прямые подчинённые) — один пакетный запрос на список активных задач,
  // без похода к БД на каждого сотрудника отдельно.
  const teamUserIds = [
    ...manager.leads.map((lead) => lead.id),
    ...manager.leads.flatMap((lead) => lead.reports.map((report) => report.id)),
    ...manager.directReports.map((employee) => employee.id),
  ];
  const tasksByUserId = await getActiveTasksForUsers(teamUserIds);

  return (
    <>
      <PageHeader title={manager.fullName} subtitle={`Команда · ${department.name}`} />
      <div className="p-8">
        <TeamDetailView
          departmentId={department.id}
          hierarchy={hierarchy}
          managerId={managerId}
          employees={department.employees}
          tasksByUserId={tasksByUserId}
          canManage={canManageDept}
        />
      </div>
    </>
  );
}
