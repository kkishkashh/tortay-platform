import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { hasPulseAccess } from "@/lib/pulse/queries";
import { getTeamWorkload } from "@/lib/team/queries";
import { pluralizeProjects } from "@/lib/utils";
import { WORKLOAD_META } from "@/lib/workload";

// Команда/загрузка (Phase 4, финальная фаза архитектурного дашборда,
// 2026-07-30, из прототипа ProjecTeam) — количество активных проектов +
// разбивка по сигналу пульса этой недели, БЕЗ персональных рейтингов
// (по прямой просьбе Камилы). Та же видимость, что у Пульса/Ганта.
export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!(await hasPulseAccess(session.user))) {
    redirect("/");
  }

  const employees = await getTeamWorkload(session.user);

  return (
    <>
      <PageHeader title="Команда" subtitle="Загрузка проектами и сигнал пульса — без персональных оценок" />
      <div className="p-8">
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">В департаменте пока нет сотрудников.</p>
        ) : (
          <div className="space-y-2">
            {employees.map((employee) => {
              const meta = WORKLOAD_META[employee.level];
              const totalSignals = employee.pulse.green + employee.pulse.yellow + employee.pulse.red + employee.pulse.none;
              return (
                <Card key={employee.id} className="flex-row items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {employee.activeProjectsCount} {pluralizeProjects(employee.activeProjectsCount)} · {meta.label}
                    </p>
                    <div className="mt-1.5 h-1.5 w-40 rounded-full" style={{ backgroundColor: meta.color }} />
                  </div>
                  {totalSignals > 0 ? (
                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {employee.pulse.green > 0 ? <span>🟢 {employee.pulse.green}</span> : null}
                      {employee.pulse.yellow > 0 ? <span>🟡 {employee.pulse.yellow}</span> : null}
                      {employee.pulse.red > 0 ? <span>🔴 {employee.pulse.red}</span> : null}
                      {employee.pulse.none > 0 ? <span>⚪ {employee.pulse.none} без сигнала</span> : null}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
