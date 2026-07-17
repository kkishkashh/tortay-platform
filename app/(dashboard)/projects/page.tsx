import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getEmployeesForSelect } from "@/lib/employees/queries";
import { canManageOperations } from "@/lib/projects/permissions";
import { getProjectsForCurrentUser } from "@/lib/projects/queries";
import { formatTodayLabel } from "@/lib/utils";

import { NewProjectDialog } from "./new-project-dialog";
import { ProjectsExplorer } from "./projects-explorer";

export default async function ProjectsPage() {
  const [session, projects, employees] = await Promise.all([
    auth(),
    getProjectsForCurrentUser(),
    getEmployeesForSelect(),
  ]);
  const canManage = session?.user ? canManageOperations(session.user) : false;

  return (
    <>
      <PageHeader
        title="Проекты"
        subtitle={formatTodayLabel(new Date())}
        action={canManage ? <NewProjectDialog employees={employees} /> : undefined}
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
