import { SystemRole } from "@prisma/client";
import Link from "next/link";
import { Banknote, CheckCircle2, FolderKanban, User, Users } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { WorkloadBoard } from "@/components/dashboard/workload-board";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import { ProjectGantt } from "@/components/dashboard/project-gantt";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import {
  getDashboardStats,
  getEmployeeWorkload,
  getRecentActivity,
  getUpcomingPayments,
  getProjectTimelines,
} from "@/lib/dashboard/queries";
import { formatTenge, formatTodayLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const [session, stats, workload, activity, upcomingPayments, timelines] =
    await Promise.all([
      auth(),
      getDashboardStats(),
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
        action={
          session?.user ? (
            <Button
              nativeButton={false}
              render={<Link href={`/employees/${session.user.id}`} />}
            >
              <User className="size-4" />
              Личный кабинет
            </Button>
          ) : undefined
        }
      />
      <div
        className={`grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 ${isHead ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
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
        {isHead ? (
          <StatCard
            label="К получению"
            value={
              stats.pendingPaymentsTotal === null
                ? "—"
                : formatTenge(stats.pendingPaymentsTotal)
            }
            icon={Banknote}
          />
        ) : null}
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
