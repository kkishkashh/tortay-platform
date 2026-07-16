import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getEmployeesForSelect } from "@/lib/employees/queries";
import { getProjectsForCurrentUser } from "@/lib/projects/queries";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";

import { NewProjectDialog } from "./new-project-dialog";

export default async function ProjectsPage() {
  const [projects, employees] = await Promise.all([
    getProjectsForCurrentUser(),
    getEmployeesForSelect(),
  ]);

  return (
    <>
      <PageHeader
        title="Проекты"
        action={<NewProjectDialog employees={employees} />}
      />
      <div className="p-8">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Пока нет ни одного проекта — создайте первый.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{project.name}</h3>
                  <Badge variant="secondary">
                    {PROJECT_STATUS_LABELS[project.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Участников: {project._count.members}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
