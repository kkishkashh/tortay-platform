import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getOutsourcerById } from "@/lib/outsourcers/queries";
import { canManageOperations } from "@/lib/projects/permissions";
import { formatTenge, getAvatarColor, getInitials } from "@/lib/utils";

export default async function OutsourcerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canManageOperations(session.user)) {
    redirect("/");
  }

  const { id } = await params;
  const outsourcer = await getOutsourcerById(id);
  if (!outsourcer) {
    notFound();
  }

  return (
    <>
      <PageHeader title={outsourcer.organization} />
      <div className="p-8">
        <div className="flex items-center gap-4">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(outsourcer.id) }}
          >
            {getInitials(outsourcer.organization)}
          </span>
          <div>
            <p className="text-lg font-medium">{outsourcer.organization}</p>
            <p className="text-sm text-muted-foreground">{outsourcer.specialization}</p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Телефон</dt>
            <dd className="text-sm">{outsourcer.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="text-sm">{outsourcer.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ставка</dt>
            <dd className="text-sm">{formatTenge(Number(outsourcer.rate))}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Договор</dt>
            <dd className="text-sm">
              {outsourcer.contractNumber ? (
                <Badge variant="secondary">{outsourcer.contractNumber}</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Нет
                </Badge>
              )}
            </dd>
          </div>
        </dl>

        <p className="mt-8 text-sm text-muted-foreground">
          Назначенные проекты и редактирование появятся здесь на следующих шагах.
        </p>
      </div>
    </>
  );
}
