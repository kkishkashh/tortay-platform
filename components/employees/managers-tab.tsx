"use client";

import { useTransition } from "react";
import { KeyRound, Power, PowerOff } from "lucide-react";

import {
  deactivateManagerAction,
  reactivateManagerAction,
  resetManagerPasswordAction,
} from "@/lib/managers/actions";
import type { DepartmentListItem } from "@/lib/departments/queries";
import type { ManagerListItem } from "@/lib/managers/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/ui/user-avatar";
import { CreateManagerDialog } from "@/components/employees/create-manager-dialog";
import { EditManagerDialog } from "@/components/employees/edit-manager-dialog";
import { DeleteManagerDialog } from "@/components/employees/delete-manager-dialog";

function ManagerRowActions({ manager }: { manager: ManagerListItem }) {
  const [isPending, startTransition] = useTransition();

  function handleResetPassword() {
    if (!confirm(`Сбросить пароль руководителя «${manager.fullName}»? Новый пароль придёт письмом.`)) {
      return;
    }
    startTransition(() => {
      resetManagerPasswordAction(manager.id).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось сбросить пароль");
      });
    });
  }

  function handleToggleActive() {
    startTransition(() => {
      const action = manager.isActive ? deactivateManagerAction : reactivateManagerAction;
      action(manager.id).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить статус");
      });
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        title="Сбросить пароль"
        onClick={handleResetPassword}
        disabled={isPending}
      >
        <KeyRound className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title={manager.isActive ? "Деактивировать" : "Активировать"}
        onClick={handleToggleActive}
        disabled={isPending}
      >
        {manager.isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}
      </Button>
    </div>
  );
}

export function ManagersTab({
  managers,
  departments,
  isAdmin,
}: {
  managers: ManagerListItem[];
  departments: DepartmentListItem[];
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="flex justify-end">
          <CreateManagerDialog departments={departments} />
        </div>
      ) : null}

      {managers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Руководителей пока нет.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Руководитель</TableHead>
              <TableHead>Департамент</TableHead>
              <TableHead>Статус</TableHead>
              {isAdmin ? <TableHead className="text-right">Действия</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.map((manager) => (
              <TableRow key={manager.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      avatarUrl={manager.avatarUrl}
                      fullName={manager.fullName}
                      seed={manager.id}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{manager.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{manager.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {manager.departmentName ? (
                    <Badge variant="outline">{manager.departmentName}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Не назначен</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={manager.isActive ? "success" : "secondary"}>
                    {manager.isActive ? "Активен" : "Деактивирован"}
                  </Badge>
                </TableCell>
                {isAdmin ? (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <EditManagerDialog manager={manager} departments={departments} />
                      <ManagerRowActions manager={manager} />
                      <DeleteManagerDialog userId={manager.id} fullName={manager.fullName} />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
