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
import { isFullAdmin } from "@/lib/auth/roles";
import { getAuditLog } from "@/lib/audit/queries";
import { formatTodayLabel } from "@/lib/utils";

// Только администратор компании (АДМИН/ГЛАВНЫЙ_ТЕХНИЧЕСКИЙ_ДИРЕКТОР) — та
// же граница, что и у пункта "Аудит-лог" в боковом меню (visibility:
// "admin", см. sidebar.tsx + getCurrentUserRoleTier). Раньше здесь стояла
// canManageDepartments — исторически это означало то же самое (systemRole
// === РУКОВОДИТЕЛЬ), но с 2026-08-05 canManageDepartments также открыта
// ГИП/Руководителю, а с 2026-08-06 ещё и Менеджеру (см. lib/departments/
// permissions.ts) — эти роли НЕ должны видеть аудит-лог (по прямой
// просьбе), только боковое меню их и так уже скрывало, но прямая ссылка
// на /audit-log их бы пускала. Проверяем isFullAdmin напрямую, без
// переиспользования более широкой canManageDepartments.
export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user || !isFullAdmin(session.user.systemRole)) {
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
  employee_all_projects_access_change: "Изменил(а) доступ ко всем проектам у сотрудника",
  hard_delete: "Удалил(а) безвозвратно",
  lead_assign: "Назначил(а) Ведущего архитектора",
  lead_unassign: "Снял(а) Ведущего архитектора",
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
