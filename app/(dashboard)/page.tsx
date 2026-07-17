import { SystemRole } from "@prisma/client";
import { Banknote, CheckCircle2, FolderKanban, Users } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkloadBoard } from "@/components/dashboard/workload-board";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import { ProjectGantt } from "@/components/dashboard/project-gantt";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { getEmployeesForSelect } from "@/lib/employees/queries";
import {
  getDashboardStats,
  getEmployeeWorkload,
  getRecentActivity,
  getUpcomingPayments,
  getProjectTimelines,
} from "@/lib/dashboard/queries";
import { formatTenge, formatTodayLabel } from "@/lib/utils";

import { NewProjectDialog } from "./projects/new-project-dialog";

export default async function DashboardPage() {
  const [session, stats, employees, workload, activity, upcomingPayments, timelines] =
    await Promise.all([
      auth(),
      getDashboardStats(),
      getEmployeesForSelect(),
      getEmployeeWorkload(),
      getRecentActivity(),
      getUpcomingPayments(),
      getProjectTimelines(),
    ]);
  const isHead = session?.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const today = new Date();
  const currentYear = today.getFullYear();

  return (
    <>
      <PageHeader
        title="Дашборд"
        subtitle={formatTodayLabel(today)}
        action={isHead ? <NewProjectDialog employees={employees} /> : undefined}
      />
      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Активные проекты"
          value={String(stats.activeProjectsCount)}
          icon={FolderKanban}
        />
        <StatCard
          label="Сотрудники"
          value={String(stats.employeesCount)}
          icon={Users}
        />
        <StatCard
          label="К получению"
          value={
            stats.pendingPaymentsTotal === null
              ? "—"
              : formatTenge(stats.pendingPaymentsTotal)
          }
          icon={Banknote}
        />
        <StatCard
          label={`Завершено в ${currentYear} году`}
          value={String(stats.completedThisYearCount)}
          icon={CheckCircle2}
        />
      </div>

      <div className="space-y-6 px-8 pb-8">
        <ProjectGantt timelines={timelines} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WorkloadBoard employees={workload} />
          <RecentActivity items={activity} />
        </div>

        {isHead ? (
          <UpcomingPayments payments={upcomingPayments} />
        ) : (
          <DashboardPanel title="Предстоящие платежи">
            <p className="text-sm text-muted-foreground">
              Финансовые данные доступны только руководителю.
            </p>
          </DashboardPanel>
        )}
      </div>
    </>
  );
}
