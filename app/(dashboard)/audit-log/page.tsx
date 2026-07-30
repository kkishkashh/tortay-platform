import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canManageDepartments } from "@/lib/departments/permissions";
import { getAuditLog } from "@/lib/audit/queries";
import { formatTodayLabel } from "@/lib/utils";

// Только администратор компании — руководители департаментов и бухгалтеры
// с financeAccess сюда не допускаются, это не их зона (см. план PRD #3,
// Phase 1: "Manager/Lead не видят"). canManageDepartments — та же проверка,
// что и у "Департаменты"/"Руководители", здесь означает то же самое:
// systemRole === РУКОВОДИТЕЛЬ.
export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    redirect("/");
  }

  const entries = await getAuditLog();

  return (
    <>
      <PageHeader title="Аудит-лог" subtitle={formatTodayLabel(new Date())} />
      <div className="p-8">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Записей пока нет.</p>
        ) : (
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Кто</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Цель</TableHead>
                  <TableHead>Вмешательство</TableHead>
                  <TableHead>Когда</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.actorName}</TableCell>
                    <TableCell>{ACTION_LABELS[entry.action] ?? entry.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {TARGET_TYPE_LABELS[entry.targetType] ?? entry.targetType} #{entry.targetId.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {entry.isOverride ? (
                        <Badge variant="warning">Override</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}

const ACTION_LABELS: Record<string, string> = {
  task_reassign: "Переназначил(а) исполнителя задачи",
  task_unassign: "Снял(а) исполнителя с задачи",
  department_manager_reassign: "Переназначил(а) руководителя департамента",
  employee_role_change: "Изменил(а) системную роль сотрудника",
  employee_finance_access_change: "Изменил(а) финансовый доступ сотрудника",
  hard_delete: "Удалил(а) безвозвратно",
  lead_assign: "Назначил(а) Лида",
  lead_unassign: "Снял(а) Лида",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  Task: "Задача",
  Department: "Департамент",
  User: "Сотрудник",
  Project: "Проект",
};

function formatDateTime(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
