import { AlertTriangle, CheckCircle2, FolderKanban, ListTodo } from "lucide-react";

import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatCard } from "@/components/dashboard/stat-card";
import { TaskStatusChart } from "@/components/dashboard/task-status-chart";
import type { DepartmentDashboardStats } from "@/lib/departments/queries";

export function AnalyticsTab({
  stats,
  departmentId,
}: {
  stats: DepartmentDashboardStats;
  departmentId: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Проектов"
          value={String(stats.projectsCount)}
          icon={FolderKanban}
          color="blue"
          href={`/departments/${departmentId}?tab=projects`}
        />
        <StatCard label="Активных задач" value={String(stats.activeTasksCount)} icon={ListTodo} color="gold" />
        <StatCard label="Выполнено задач" value={String(stats.completedTasksCount)} icon={CheckCircle2} color="green" />
        <StatCard
          label="Просроченных задач"
          value={String(stats.overdueTasksCount)}
          icon={AlertTriangle}
          color="purple"
        />
      </div>

      <TaskStatusChart data={stats.taskStatusBreakdown} />

      <RecentActivity items={stats.recentActivity} />
    </div>
  );
}
