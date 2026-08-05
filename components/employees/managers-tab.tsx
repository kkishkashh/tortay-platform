"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Power, PowerOff } from "lucide-react";

import { deactivateManagerAction, reactivateManagerAction } from "@/lib/managers/actions";
import type { DepartmentListItem, ManagerCandidate } from "@/lib/departments/queries";
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
import { RemoveFromManagersDialog } from "@/components/employees/remove-from-managers-dialog";

function ManagerRowActions({ manager }: { manager: ManagerListItem }) {
  const [isPending, startTransition] = useTransition();

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
  employeeCandidates,
  isAdmin,
}: {
  managers: ManagerListItem[];
  departments: DepartmentListItem[];
  employeeCandidates: ManagerCandidate[];
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="flex justify-end">
          <CreateManagerDialog departments={departments} employeeCandidates={employeeCandidates} />
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
                  <Link
                    href={`/employees/${manager.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
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
                  </Link>
                </TableCell>
                <TableCell>
                  {manager.managedDepartments.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {manager.managedDepartments.map((department) => (
                        <Badge key={department.id} variant="outline">
                          {department.name}
                        </Badge>
                      ))}
                    </div>
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
                      <EditManagerDialog manager={manager} />
                      <ManagerRowActions manager={manager} />
                      <RemoveFromManagersDialog userId={manager.id} fullName={manager.fullName} />
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
