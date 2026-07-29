import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";
import { formatTenge } from "@/lib/utils";
import type { ProjectStatus } from "@prisma/client";

type Engagement = {
  id: string;
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  contractNumber: string | null;
  totalAmount: number | null;
};

export function OutsourcerProjectsList({ engagements }: { engagements: Engagement[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Проекты</CardTitle>
      </CardHeader>
      <CardContent>
        {engagements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Пока не привязан ни к одному проекту — добавьте его прямо со страницы нужного проекта.
          </p>
        ) : (
          <div className="space-y-2">
            {engagements.map((engagement) => (
              <Link
                key={engagement.id}
                href={`/projects/${engagement.projectId}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{engagement.projectName}</p>
                  <p className="text-xs text-muted-foreground">
                    {PROJECT_STATUS_LABELS[engagement.projectStatus]}
                    {engagement.contractNumber ? ` · ${engagement.contractNumber}` : ""}
                  </p>
                </div>
                {engagement.totalAmount ? (
                  <Badge variant="secondary" className="shrink-0">
                    {formatTenge(engagement.totalAmount)}
                  </Badge>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
