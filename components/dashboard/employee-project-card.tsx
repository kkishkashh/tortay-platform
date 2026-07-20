import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { ArrowRight, CalendarClock, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProjectListItem } from "@/lib/projects/queries";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";

const STATUS_STYLE: Record<ProjectStatus, { stripe: string; badge: "info" | "warning" | "success" }> = {
  [ProjectStatus.В_РАБОТЕ]: { stripe: "bg-[#2563eb]", badge: "info" },
  [ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ]: { stripe: "bg-[#e8a030]", badge: "warning" },
  [ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ]: { stripe: "bg-[#16a34a]", badge: "success" },
};

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export function EmployeeProjectCard({ project }: { project: ProjectListItem }) {
  const style = STATUS_STYLE[project.status];
  const progressPercent =
    project.totalSections === 0 ? 0 : (project.completedSections / project.totalSections) * 100;

  return (
    <Card hoverable className="relative gap-0 overflow-hidden p-0">
      <div className={`h-1.5 w-full ${style.stripe}`} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="font-semibold tracking-tight hover:underline"
          >
            {project.name}
          </Link>
          <Badge variant={style.badge}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
        </div>

        {project.gipName ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserRound className="size-3.5" />
            ГИП: {project.gipName}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Прогресс разделов</span>
            <span className="tabular-nums">
              {project.completedSections}/{project.totalSections}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                project.isOverdue ? "bg-destructive" : style.stripe
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {project.deadline ? formatDate(project.deadline) : "Срок не задан"}
            {project.isOverdue ? (
              <Badge variant="destructive" className="ml-1">
                Задержан
              </Badge>
            ) : null}
          </div>
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-150 hover:underline"
          >
            Открыть <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
