import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DepartmentProjectItem } from "@/lib/departments/queries";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";

export function ProjectsTab({ projects }: { projects: DepartmentProjectItem[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">Этот департамент пока не участвует ни в одном проекте.</p>;
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <Link key={project.id} href={`/projects/${project.id}`} className="block">
          <Card size="sm" hoverable>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{project.name}</p>
                <p className="truncate text-xs text-muted-foreground">Раздел: {project.sectionName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {project.completedTasksCount}/{project.tasksCount} задач
                </span>
                <Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status]}</Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
