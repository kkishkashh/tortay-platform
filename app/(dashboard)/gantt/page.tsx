import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleSwitcher } from "@/components/schedule/schedule-switcher";
import { getMyCalendarDeadlineItems } from "@/lib/calendar/queries";
import { getGanttData } from "@/lib/gantt/queries";
import { getPulseDashboard, hasPulseAccess } from "@/lib/pulse/queries";
import { getTeamWorkload } from "@/lib/team/queries";

// Единственный оставшийся в сайдбаре пункт вместо трёх отдельных — "Пульс
// недели", "Гант" и "Календарь" объединены сюда одним переключателем
// (2026-08-07, по прямой просьбе: "в сайдбаре должен быть только ГАНТ, а
// внутри ганта уже пульс и календарь"). /pulse и /calendar как роуты
// остаются на месте (ничего не удаляем), просто больше не даём на них
// ссылку из меню. Тот же гейт видимости, что был у ссылок "Пульс
// недели"/"Гант" в сайдбаре — hasPulseAccess, без обхода для админа.
export default async function GanttPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!(await hasPulseAccess(session.user))) {
    redirect("/");
  }

  const [ganttData, pulseDashboard, calendarItems, teamEmployees] = await Promise.all([
    getGanttData(session.user),
    getPulseDashboard(session.user),
    getMyCalendarDeadlineItems(),
    getTeamWorkload(session.user),
  ]);

  return (
    <>
      <PageHeader title="Гант" />
      <div className="p-8">
        <ScheduleSwitcher
          pulseSections={pulseDashboard.sections}
          ganttData={ganttData}
          calendarItems={calendarItems}
          teamEmployees={teamEmployees}
          groupByDepartment
        />
      </div>
    </>
  );
}
