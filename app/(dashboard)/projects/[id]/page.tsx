import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/projects/permissions";
import {
  PROJECT_STATUS_LABELS,
  SECTION_STATUS_LABELS,
} from "@/lib/projects/status-labels";

import { ProjectStatusSelect } from "./project-status-select";
import { SectionDatesFields } from "./section-dates-fields";
import { SectionStatusSelect } from "./section-status-select";

function formatSectionDates(startDate: Date | null, deadline: Date | null) {
  if (!startDate && !deadline) return "Сроки не заданы";
  const format = (date: Date) =>
    date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${startDate ? format(startDate) : "?"} — ${deadline ? format(deadline) : "?"}`;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, project, sections] = await Promise.all([
    auth(),
    prisma.project.findUnique({ where: { id } }),
    prisma.section.findMany({
      where: { projectId: id },
      orderBy: { orderIndex: "asc" },
    }),
  ]);
  if (!project) {
    notFound();
  }

  const canChangeStatus = session?.user ? canManageOperations(session.user) : false;

  return (
    <>
      <PageHeader title={project.name} />
      <div className="p-8">
        {canChangeStatus ? (
          <ProjectStatusSelect projectId={project.id} status={project.status} />
        ) : (
          <Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status]}</Badge>
        )}

        <h2 className="mt-8 mb-3 text-sm font-medium text-muted-foreground">
          Разделы
        </h2>
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Разделов пока нет.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sections.map((section) => (
              <li
                key={section.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm font-medium">{section.name}</span>
                <div className="flex flex-wrap items-center gap-3">
                  {canChangeStatus ? (
                    <SectionDatesFields
                      sectionId={section.id}
                      startDate={section.startDate}
                      deadline={section.deadline}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {formatSectionDates(section.startDate, section.deadline)}
                    </span>
                  )}
                  {canChangeStatus ? (
                    <SectionStatusSelect
                      sectionId={section.id}
                      status={section.status}
                    />
                  ) : (
                    <Badge variant="secondary">
                      {SECTION_STATUS_LABELS[section.status]}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-sm text-muted-foreground">
          Задачи и документы появятся здесь на следующих шагах.
        </p>
      </div>
    </>
  );
}
