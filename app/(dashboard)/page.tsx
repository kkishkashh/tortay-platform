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
import { ProjectStatusChart } from "@/components/dashboard/project-status-chart";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import {
  getDashboardStats,
  getEmployeeWorkload,
  getRecentActivity,
  getUpcomingPayments,
  getProjectTimelines,
  getProjectStatusBreakdown,
  getUpcomingDeadlines,
} from "@/lib/dashboard/queries";
import { getProjectsForCurrentUser } from "@/lib/projects/queries";
import { formatTenge, formatTodayLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const isHead = session?.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const today = new Date();
  const currentYear = today.getFullYear();

  const cabinetButton = session?.user ? (
    <Button nativeButton={false} render={<Link href={`/employees/${session.user.id}`} />}>
      <User className="size-4" />
      Личный кабинет
    </Button>
  ) : undefined;

  if (!isHead) {
    const [stats, deadlines, projects, activity] = await Promise.all([
      getDashboardStats(),
      getUpcomingDeadlines(),
      getProjectsForCurrentUser(),
      getRecentActivity(),
    ]);

    return (
      <>
        <PageHeader title="Дашборд" subtitle={formatTodayLabel(today)} action={cabinetButton} />
        <EmployeeDashboard
          fullName={session?.user.name ?? "коллега"}
          activeProjectsCount={stats.activeProjectsCount}
          completedThisYearCount={stats.completedThisYearCount}
          deadlines={deadlines}
          projects={projects}
          activity={activity}
        />
      </>
    );
  }

  const [stats, workload, activity, upcomingPayments, timelines, statusBreakdown] =
    await Promise.all([
      getDashboardStats(),
      getEmployeeWorkload(),
      getRecentActivity(),
      getUpcomingPayments(),
      getProjectTimelines(),
      getProjectStatusBreakdown(),
    ]);

  return (
    <>
      <PageHeader title="Дашборд" subtitle={formatTodayLabel(today)} action={cabinetButton} />
      <div className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Активные проекты"
          value={String(stats.activeProjectsCount)}
          icon={FolderKanban}
          color="blue"
        />
        <StatCard
          label="Сотрудники"
          value={String(stats.employeesCount)}
          icon={Users}
          color="green"
        />
        <StatCard
          label="К получению"
          value={
            stats.pendingPaymentsTotal === null ? "—" : formatTenge(stats.pendingPaymentsTotal)
          }
          icon={Banknote}
          color="gold"
        />
        <StatCard
          label={`Завершено в ${currentYear} году`}
          value={String(stats.completedThisYearCount)}
          icon={CheckCircle2}
          color="purple"
        />
      </div>

      <div className="space-y-6 px-8 pb-8">
        <ProjectGantt timelines={timelines} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WorkloadBoard employees={workload} />
          <ProjectStatusChart data={statusBreakdown} />
        </div>

        <RecentActivity items={activity} />

        <UpcomingPayments payments={upcomingPayments} />
      </div>
    </>
  );
}
