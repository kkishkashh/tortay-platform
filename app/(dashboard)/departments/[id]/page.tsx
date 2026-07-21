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
  getDepartmentById,
  getDepartmentDashboardStats,
  getDepartmentProjects,
  getDepartmentTaskStack,
  getEmployeesForDepartmentAssignment,
} from "@/lib/departments/queries";

import { AnalyticsTab } from "./analytics-tab";
import { DeleteDepartmentDialog } from "./delete-department-dialog";
import { EditDepartmentDialog } from "./edit-department-dialog";
import { EmployeesTab } from "./employees-tab";
import { ProjectsTab } from "./projects-tab";
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
  if (!canManageDept) {
    // Пока сотрудник без роли руководителя департамента не имеет здесь
    // дела — просмотр департаментов для рядовых сотрудников появится
    // вместе с 3-уровневым меню (см. финальные фазы плана).
    redirect("/");
  }

  const [taskStack, allEmployees, projects, analyticsStats] = await Promise.all([
    getDepartmentTaskStack(id),
    getEmployeesForDepartmentAssignment(),
    getDepartmentProjects(id),
    getDepartmentDashboardStats(id),
  ]);

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
              {department.managerName ? ` · Руководитель: ${department.managerName}` : ""}
            </p>
          </div>
        </div>

        <Tabs defaultValue="employees">
          <TabsList>
            <TabsTrigger value="employees">Сотрудники</TabsTrigger>
            <TabsTrigger value="task-stack">Базовый набор задач</TabsTrigger>
            <TabsTrigger value="projects">Проекты</TabsTrigger>
            <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="mt-4">
            <EmployeesTab
              departmentId={department.id}
              managerId={department.managerId}
              employees={department.employees}
              allEmployees={allEmployees}
              canManageDept={isAdmin}
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
        </Tabs>
      </div>
    </>
  );
}
