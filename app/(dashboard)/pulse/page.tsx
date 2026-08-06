import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { PulseList } from "@/components/pulse/pulse-list";
import { getPulseDashboard, hasPulseAccess } from "@/lib/pulse/queries";
import { weekLabel } from "@/lib/pulse/week";

// "Пульс недели" (Phase 1 дашборда департамента Архитектуры, 2026-07-30) —
// еженедельный сигнал-статус по разделам вместо ежедневных отчётов, из
// прототипа ProjecTeam. Доступен только пользователям с видимым
// департаментом, где включён Department.usesPulseTracking (см.
// hasPulseAccess) — сейчас это Архитектура.
export default async function PulsePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!(await hasPulseAccess(session.user))) {
    redirect("/");
  }

  const { isoWeek, sections } = await getPulseDashboard(session.user);

  return (
    <>
      <PageHeader title="Пульс недели" subtitle={`Неделя: ${weekLabel(isoWeek)}`} />
      <div className="space-y-6 p-8">
        <PulseList sections={sections} />
      </div>
    </>
  );
}
