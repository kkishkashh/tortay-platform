import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getDepartmentsWithTaskStackForProjectCreation } from "@/lib/departments/queries";
import { getEmployeesForSelect } from "@/lib/employees/queries";
import { canManageOperations, userManagesAnyDepartment } from "@/lib/projects/permissions";
import { getProjectsForCurrentUser } from "@/lib/projects/queries";
import { formatTodayLabel } from "@/lib/utils";

import { NewProjectDialog } from "./new-project-dialog";
import { ProjectsExplorer } from "./projects-explorer";

export default async function ProjectsPage() {
  const [session, projects, employees, departments] = await Promise.all([
    auth(),
    getProjectsForCurrentUser(),
    getEmployeesForSelect(),
    getDepartmentsWithTaskStackForProjectCreation(),
  ]);
  const managesAnyDepartment = session?.user ? await userManagesAnyDepartment(session.user) : false;
  const canManage = session?.user ? canManageOperations(session.user, managesAnyDepartment) : false;

  return (
    <>
      <PageHeader
        title="Проекты"
        subtitle={formatTodayLabel(new Date())}
        action={
          canManage ? (
            <NewProjectDialog
              employees={employees}
              departments={departments}
              currentUserId={session?.user?.id ?? null}
            />
          ) : undefined
        }
      />
      <div className="p-8">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Пока нет ни одного проекта — создайте первый.
          </p>
        ) : (
          <ProjectsExplorer projects={projects} />
        )}
      </div>
    </>
  );
}
