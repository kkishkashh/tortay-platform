import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { getGanttData } from "@/lib/gantt/queries";
import { hasPulseAccess } from "@/lib/pulse/queries";

function formatShort(date: Date) {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

// Гант с базовым/текущим сроком (Phase 3 архитектурного дашборда,
// 2026-07-30, из прототипа ProjecTeam). Та же видимость, что у "Пульс
// недели" (см. hasPulseAccess) — строго члены департамента с
// usesPulseTracking, без обхода для админа.
export default async function GanttPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!(await hasPulseAccess(session.user))) {
    redirect("/");
  }

  const data = await getGanttData(session.user);

  return (
    <>
      <PageHeader
        title="Гант"
        subtitle={
          data.rangeStart && data.rangeEnd
            ? `${formatShort(data.rangeStart)} — ${formatShort(data.rangeEnd)}`
            : undefined
        }
      />
      <div className="p-8">
        <GanttChart data={data} />
      </div>
    </>
  );
}
