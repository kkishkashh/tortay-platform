import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    notFound();
  }

  return (
    <>
      <PageHeader title={project.name} />
      <div className="p-8">
        <Badge variant="secondary">{PROJECT_STATUS_LABELS[project.status]}</Badge>
        <p className="mt-4 text-sm text-muted-foreground">
          Разделы, задачи и документы появятся здесь на следующих шагах.
        </p>
      </div>
    </>
  );
}
