"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Power, PowerOff } from "lucide-react";

import { deactivateManagerAction, reactivateManagerAction } from "@/lib/managers/actions";
import type { DepartmentListItem, ManagerCandidate } from "@/lib/departments/queries";
import type { ChiefTechnicalDirectorItem, ManagerListItem } from "@/lib/managers/queries";
import type { PositionItem } from "@/lib/positions/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  chiefTechnicalDirectors,
  managers,
  departments,
  employeeCandidates,
  isAdmin,
  positions,
  gipPickerProjects,
}: {
  chiefTechnicalDirectors: ChiefTechnicalDirectorItem[];
  managers: ManagerListItem[];
  departments: DepartmentListItem[];
  employeeCandidates: ManagerCandidate[];
  isAdmin: boolean;
  positions: PositionItem[];
  gipPickerProjects: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-4">
      {chiefTechnicalDirectors.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Главный технический директор
          </h3>
          {chiefTechnicalDirectors.map((director) => (
            <Card key={director.id}>
              <CardContent className="flex items-center justify-between gap-3">
                <Link
                  href={`/employees/${director.id}`}
                  className="flex items-center gap-3 hover:underline"
                >
                  <UserAvatar
                    avatarUrl={director.avatarUrl}
                    fullName={director.fullName}
                    seed={director.id}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{director.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{director.email}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant={director.isActive ? "success" : "secondary"}>
                    {director.isActive ? "Активен" : "Деактивирован"}
                  </Badge>
                  <Badge variant="outline">Права как у Админа</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

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
                      <RemoveFromManagersDialog
                        userId={manager.id}
                        fullName={manager.fullName}
                        currentPosition={manager.position}
                        positions={positions}
                        gipPickerProjects={gipPickerProjects}
                        currentGipProjectIds={manager.gipProjectIds}
                      />
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
