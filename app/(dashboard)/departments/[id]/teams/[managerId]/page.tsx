import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { canManageDepartment } from "@/lib/departments/permissions";
import { getCurrentUserRoleTier, getDepartmentById, getDepartmentProjects } from "@/lib/departments/queries";
import { getDepartmentHierarchy, isLeadOfDepartment } from "@/lib/leads/queries";
import { getProjectsForUsers } from "@/lib/projects/queries";
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
  // app/(dashboard)/departments/[id]/page.tsx) — это её под-страница, плюс
  // тот же случай Ведущего архитектора ЭТОГО департамента.
  const canManageDept = canManageDepartment(session.user, department);
  const roleTier = await getCurrentUserRoleTier(session.user);
  const canView =
    canManageDept ||
    roleTier === "department_manager" ||
    (await isLeadOfDepartment(session.user.id, id));
  if (!canView) {
    redirect("/");
  }

  const hierarchy = await getDepartmentHierarchy(id);
  const manager = hierarchy.managers.find((m) => m.id === managerId);
  if (!manager) {
    notFound();
  }

  // Все сотрудники команды этого руководителя (сами Ведущие архитекторы +
  // их команды + прямые подчинённые) — один пакетный запрос на список
  // активных задач, без похода к БД на каждого сотрудника отдельно.
  const teamUserIds = [
    ...manager.leads.map((lead) => lead.id),
    ...manager.leads.flatMap((lead) => lead.reports.map((report) => report.id)),
    ...manager.directReports.map((employee) => employee.id),
  ];
  // Проекты, прикреплённые к самому руководителю и к каждому его Ведущему
  // архитектору (см. team-detail-view.tsx::ProjectsBlock) — один пакетный
  // запрос на всех сразу, а не по человеку.
  const blockOwnerIds = [manager.id, ...manager.leads.map((lead) => lead.id)];
  const [tasksByUserId, departmentProjectsRaw, projectsByUserId] = await Promise.all([
    getActiveTasksForUsers(teamUserIds),
    getDepartmentProjects(id),
    getProjectsForUsers(blockOwnerIds),
  ]);
  // Пикер "прикрепить проект" — только уникальные проекты (getDepartmentProjects
  // отдаёт по одной строке на КАЖДЫЙ раздел, один проект может встретиться
  // несколько раз, если в нём несколько разделов этого департамента).
  const departmentProjects = Array.from(
    new Map(departmentProjectsRaw.map((p) => [p.id, { id: p.id, name: p.name }])).values(),
  );

  return (
    <>
      <PageHeader title={manager.fullName} subtitle={`Команда · ${department.name}`} />
      <div className="p-8">
        <TeamDetailView
          departmentId={department.id}
          hierarchy={hierarchy}
          managerId={managerId}
          tasksByUserId={tasksByUserId}
          canManage={canManageDept}
          viewerId={session.user.id}
          departmentProjects={departmentProjects}
          projectsByUserId={projectsByUserId}
        />
      </div>
    </>
  );
}
