import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  ListTodo,
  Users,
} from "lucide-react";

import { DepartmentIcon } from "@/components/departments/department-icon";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatCard } from "@/components/dashboard/stat-card";
import { TaskStatusChart } from "@/components/dashboard/task-status-chart";
import { WorkloadBoard } from "@/components/dashboard/workload-board";
import type { EmployeeWorkload } from "@/lib/dashboard/queries";
import type { DepartmentDashboardStats } from "@/lib/departments/queries";
import { getFirstName } from "@/lib/utils";

function greetingForHour(hour: number) {
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

export function DepartmentManagerDashboard({
  fullName,
  department,
  stats,
  workload,
}: {
  fullName: string;
  department: { id: string; name: string; color: string; icon: string };
  stats: DepartmentDashboardStats;
  workload: EmployeeWorkload[];
}) {
  const firstName = getFirstName(fullName);
  const greeting = `${greetingForHour(new Date().getHours())}, ${firstName}!`;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{greeting}</h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-white"
              style={{ backgroundColor: department.color }}
            >
              <DepartmentIcon name={department.icon} className="size-3.5" />
            </span>
            Вы руководите департаментом «{department.name}»
          </div>
        </div>
        <Link
          href={`/departments/${department.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Building2 className="size-4" />
          Открыть департамент
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Сотрудников" value={String(stats.employeesCount)} icon={Users} color="green" />
        <StatCard label="Проектов" value={String(stats.projectsCount)} icon={FolderKanban} color="blue" />
        <StatCard label="Активных задач" value={String(stats.activeTasksCount)} icon={ListTodo} color="gold" />
        <StatCard
          label="Просроченных задач"
          value={String(stats.overdueTasksCount)}
          icon={AlertTriangle}
          color="purple"
        />
        <StatCard
          label="Ожидают проверки"
          value={String(stats.pendingReviewCount)}
          icon={ClipboardCheck}
          color="gold"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WorkloadBoard employees={workload} />
        <TaskStatusChart data={stats.taskStatusBreakdown} />
      </div>

      <RecentActivity items={stats.recentActivity} />

      {stats.completedTasksCount > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5" />
          Выполнено задач всего: {stats.completedTasksCount}
        </p>
      ) : null}
    </div>
  );
}
