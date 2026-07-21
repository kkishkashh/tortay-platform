"use client";

import { TaskStatus } from "@prisma/client";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { TASK_STATUS_LABELS } from "@/lib/projects/status-labels";

// Те же 4 hex, что и STATUS_STRIPE в components/dashboard/task-card.tsx —
// один и тот же цвет статуса задачи должен выглядеть одинаково и на
// карточке, и на графике.
const STATUS_COLOR: Record<TaskStatus, string> = {
  [TaskStatus.НОВАЯ]: "#9ca3af",
  [TaskStatus.В_РАБОТЕ]: "#2563eb",
  [TaskStatus.НА_ПРОВЕРКЕ]: "#e8a030",
  [TaskStatus.ВЫПОЛНЕНО]: "#16a34a",
};

export function TaskStatusChart({ data }: { data: { status: TaskStatus; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <DashboardPanel title="Задачи по статусу">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Пока нет задач.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative size-36 shrink-0">
            <PieChart width={144} height={144}>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                cx={72}
                cy={72}
                innerRadius={42}
                outerRadius={64}
                paddingAngle={data.length > 1 ? 3 : 0}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {data.map((item) => (
                  <Cell key={item.status} fill={STATUS_COLOR[item.status]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, entry) => [
                  value,
                  TASK_STATUS_LABELS[(entry.payload as { status: TaskStatus }).status],
                ]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  fontSize: 13,
                }}
              />
            </PieChart>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold">{total}</span>
              <span className="text-[11px] text-muted-foreground">всего</span>
            </div>
          </div>
          <ul className="flex-1 space-y-2">
            {data.map((item) => (
              <li key={item.status} className="flex items-center gap-2 text-sm">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[item.status] }}
                />
                <span className="flex-1 truncate">{TASK_STATUS_LABELS[item.status]}</span>
                <span className="font-medium tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardPanel>
  );
}
