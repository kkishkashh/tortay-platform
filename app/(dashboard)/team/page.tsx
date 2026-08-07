import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { TeamWorkloadList } from "@/components/team/team-workload-list";
import { hasPulseAccess } from "@/lib/pulse/queries";
import { getTeamWorkload } from "@/lib/team/queries";

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
        <TeamWorkloadList employees={employees} />
      </div>
    </>
  );
}
