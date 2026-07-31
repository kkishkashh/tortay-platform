import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepartmentIcon } from "@/components/departments/department-icon";
import {
  canManageDepartment,
  canManageDepartments,
} from "@/lib/departments/permissions";
import {
  getCurrentUserRoleTier,
  getDepartmentById,
  getDepartmentDashboardStats,
  getDepartmentProjects,
  getDepartmentTaskStack,
  getEmployeesForDepartmentAssignment,
  getEmployeesForManagerAssignment,
} from "@/lib/departments/queries";
import { getDepartmentHierarchy } from "@/lib/leads/queries";
import { getTaskWorkloadForUsers } from "@/lib/tasks/queries";

import { AnalyticsTab } from "./analytics-tab";
import { DeleteDepartmentDialog } from "./delete-department-dialog";
import { EditDepartmentDialog } from "./edit-department-dialog";
import { EmployeesTab } from "./employees-tab";
import { HierarchyTab } from "./hierarchy-tab";
import { ProjectsTab } from "./projects-tab";
import { SettingsTab } from "./settings-tab";
import { TaskStackTab } from "./task-stack-tab";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const department = await getDepartmentById(id);
  if (!department) {
    notFound();
  }

  const isAdmin = canManageDepartments(session.user);
  const canManageDept = canManageDepartment(session.user, department);
  // Task 2.1/2.2 (PRD #3 Phase 5) — руководитель ЛЮБОГО департамента (не
  // обязательно этого) тоже может открыть страницу, но только на
  // просмотр: canManageDept ниже по-прежнему смотрит именно на ЭТОТ
  // департамент, поэтому кнопки редактирования/добавления не появятся у
  // "чужого" руководителя — только рендер страницы разрешён шире. Рядовой
  // сотрудник по-прежнему не имеет здесь дела.
  const roleTier = await getCurrentUserRoleTier(session.user);
  const canView = canManageDept || roleTier === "department_manager";
  if (!canView) {
    redirect("/");
  }

  const [taskStack, allEmployeesRaw, managerCandidates, projects, analyticsStats, hierarchy] =
    await Promise.all([
      getDepartmentTaskStack(id),
      getEmployeesForDepartmentAssignment(),
      // Список кандидатов в руководители — по компании целиком, поэтому
      // запрашиваем и передаём в клиентский компонент только для админа:
      // сам селект скрыт от руководителя департамента (canAssignManager), но
      // если бы пропс всё равно долетал до его браузера в RSC-payload, это
      // была бы утечка чужих сотрудников — именно то, чего просил избежать
      // Камила при разделении сотрудников по департаментам.
      isAdmin ? getEmployeesForManagerAssignment() : Promise.resolve([]),
      getDepartmentProjects(id),
      getDepartmentDashboardStats(id),
      getDepartmentHierarchy(id),
    ]);
  // Компактный статус загрузки по задачам для каждого сотрудника — один
  // пакетный запрос на весь департамент, показывается прямо в блоках
  // вкладки "Структура" (см. hierarchy-tab.tsx), без похода на профиль
  // каждого сотрудника по отдельности.
  const workloadByUserId = await getTaskWorkloadForUsers(department.employees.map((e) => e.id));
  // Не-админ (руководитель департамента) может добавить только ещё
  // никуда не привязанного сотрудника — "переманивание" из чужого
  // департамента остаётся решением администратора (см. addEmployeeToDepartmentAction).
  const allEmployees = isAdmin
    ? allEmployeesRaw
    : allEmployeesRaw.filter((e) => e.homeDepartmentId === null);

  return (
    <>
      <PageHeader
        title={department.name}
        subtitle={department.description ?? department.code}
        action={
          isAdmin ? (
            <div className="flex gap-2">
              <EditDepartmentDialog department={department} />
              <DeleteDepartmentDialog departmentId={department.id} name={department.name} />
            </div>
          ) : undefined
        }
      />
      <div className="p-8">
        <div className="mb-6 flex items-center gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: department.color }}
          >
            <DepartmentIcon name={department.icon} className="size-6" />
          </span>
          <div>
            <p className="text-lg font-medium">{department.name}</p>
            <p className="text-sm text-muted-foreground">
              Код: {department.code}
              {department.managers.length > 0
                ? ` · ${department.managers.length > 1 ? "Руководители" : "Руководитель"}: ${department.managers
                    .map((m) => m.fullName)
                    .join(", ")}`
                : ""}
            </p>
          </div>
        </div>

        <Tabs defaultValue="employees">
          <TabsList>
            <TabsTrigger value="employees">Сотрудники</TabsTrigger>
            <TabsTrigger value="hierarchy">Структура</TabsTrigger>
            <TabsTrigger value="task-stack">Базовый набор задач</TabsTrigger>
            <TabsTrigger value="projects">Проекты</TabsTrigger>
            <TabsTrigger value="analytics">Аналитика</TabsTrigger>
            {isAdmin ? <TabsTrigger value="settings">Настройки</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="employees" className="mt-4">
            <EmployeesTab
              departmentId={department.id}
              managers={department.managers}
              employees={department.employees}
              allEmployees={allEmployees}
              managerCandidates={managerCandidates}
              canAssignManager={isAdmin}
              canManageEmployees={canManageDept}
            />
          </TabsContent>

          <TabsContent value="hierarchy" className="mt-4">
            <HierarchyTab
              allowsLeadRole={department.allowsLeadRole}
              hierarchy={hierarchy}
              employees={department.employees}
              workloadByUserId={workloadByUserId}
              canManage={canManageDept}
            />
          </TabsContent>

          <TabsContent value="task-stack" className="mt-4">
            <TaskStackTab departmentId={department.id} items={taskStack} canManage={canManageDept} />
          </TabsContent>

          <TabsContent value="projects" className="mt-4">
            <ProjectsTab projects={projects} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <AnalyticsTab stats={analyticsStats} />
          </TabsContent>

          {isAdmin ? (
            <TabsContent value="settings" className="mt-4">
              <SettingsTab department={department} />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </>
  );
}
