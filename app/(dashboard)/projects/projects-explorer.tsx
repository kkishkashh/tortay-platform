"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { ArrowRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectListItem } from "@/lib/projects/queries";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";
import { cn, getInitials } from "@/lib/utils";

// Цвета статуса — из зарезервированной статусной палитры (см. workload-board.tsx),
// кроме "в работе": это активное, а не тревожное состояние, поэтому у него
// фирменный золотой цвет платформы, а не отдельный статусный оттенок.
const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  [ProjectStatus.В_РАБОТЕ]: {
    label: PROJECT_STATUS_LABELS[ProjectStatus.В_РАБОТЕ],
    color: "var(--primary)",
  },
  [ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ]: {
    label: PROJECT_STATUS_LABELS[ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ],
    color: "#fab219",
  },
  [ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ]: {
    label: PROJECT_STATUS_LABELS[ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ],
    color: "#0ca30c",
  },
};

const OVERDUE_COLOR = "#d03b3b";

const FILTERS: { value: "all" | ProjectStatus; label: string }[] = [
  { value: "all", label: "Все" },
  { value: ProjectStatus.В_РАБОТЕ, label: "В работе" },
  { value: ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ, label: "Завершён по разделам" },
  { value: ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ, label: "Завершён полностью" },
];

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function ProjectsExplorer({ projects }: { projects: ProjectListItem[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = useMemo(() => projects.filter((p) => p.isArchived).length, [projects]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (!showArchived && project.isArchived) return false;
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${project.name} ${project.gipName ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [projects, query, statusFilter, showArchived]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию или ГИП..."
            className="h-9 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150",
                statusFilter === filter.value
                  ? "border-transparent bg-primary text-primary-foreground shadow-[0_0_0_1px_rgba(232,160,48,0.3),0_0_14px_rgba(232,160,48,0.35)]"
                  : "border-input bg-background text-foreground hover:bg-muted",
              )}
            >
              {filter.label}
            </button>
          ))}
          {archivedCount > 0 ? (
            <label className="ml-2 flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={showArchived}
                onCheckedChange={(checked) => setShowArchived(checked === true)}
              />
              Показать архив ({archivedCount})
            </label>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ничего не найдено.</p>
      ) : (
        <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название проекта</TableHead>
              <TableHead>ГИП</TableHead>
              <TableHead>Сроки</TableHead>
              <TableHead>Прогресс</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действие</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((project) => {
              const statusMeta = STATUS_META[project.status];
              const progressPercent =
                project.totalSections === 0
                  ? 0
                  : (project.completedSections / project.totalSections) * 100;
              const barColor = project.isOverdue ? OVERDUE_COLOR : statusMeta.color;

              return (
                <TableRow key={project.id} className="transition-colors duration-150">
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>
                    {project.gipName ? (
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                          {getInitials(project.gipName)}
                        </span>
                        <span className="text-sm">{project.gipName}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {project.startDate || project.deadline
                      ? `${formatDate(project.startDate)} – ${formatDate(project.deadline)}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${progressPercent}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {project.completedSections}/{project.totalSections}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1.5">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: statusMeta.color }}
                        />
                        {statusMeta.label}
                      </Badge>
                      {project.isOverdue ? (
                        <Badge variant="outline" className="border-[#d03b3b]/30 text-[#d03b3b]">
                          Задержан
                        </Badge>
                      ) : null}
                      {project.wasCreatedOverdue ? (
                        <Badge
                          variant="outline"
                          className="border-[#c47a12]/30 text-[#c47a12]"
                          title="Дедлайн уже прошёл на момент создания проекта"
                        >
                          Создан просроченным
                        </Badge>
                      ) : null}
                      {project.isArchived ? <Badge variant="secondary">В архиве</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/projects/${project.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors duration-150 hover:underline"
                    >
                      Открыть <ArrowRight className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </Card>
      )}
    </div>
  );
}
