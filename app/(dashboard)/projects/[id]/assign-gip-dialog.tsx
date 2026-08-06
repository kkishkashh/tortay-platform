"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";

import { assignGipAction, removeGipAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Employee = {
  id: string;
  fullName: string;
};

// На проекте может быть НЕСКОЛЬКО ГИП одновременно (2026-08-06, по прямой
// просьбе) — раньше это был диалог "Сменить ГИП" (замена одного на
// другого), теперь список текущих ГИП со снятием по одному + выбор нового
// в дополнение к остальным.
export function AssignGipDialog({
  projectId,
  gipMembers,
  employees,
  currentUserId,
}: {
  projectId: string;
  gipMembers: Employee[];
  employees: Employee[];
  // Для кнопки-быстрого-пути "Назначить себя ГИПом" — null у пользователей
  // без сессии (сюда практически не долетает, диалог и так виден только
  // тем, у кого есть права, но session может отсутствовать в контексте).
  currentUserId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  const gipUserIds = new Set(gipMembers.map((m) => m.id));
  const availableEmployees = employees.filter((e) => !gipUserIds.has(e.id));
  const isCurrentUserGip = currentUserId != null && gipUserIds.has(currentUserId);

  function assign(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await assignGipAction(projectId, userId);
        setSelected("");
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось назначить ГИП",
        );
      }
    });
  }

  function remove(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeGipAction(projectId, userId);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось снять ГИП");
      }
    });
  }

  function handleSubmit() {
    if (!selected) return;
    assign(selected);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserPlus className="size-4" />
        {gipMembers.length > 0 ? "Изменить ГИП" : "Назначить ГИП"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ГИП проекта</DialogTitle>
        </DialogHeader>

        {gipMembers.length > 0 ? (
          <div className="space-y-1.5">
            {gipMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <span className="truncate">{member.fullName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  onClick={() => remove(member.id)}
                  title="Снять ГИП"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {currentUserId && !isCurrentUserGip ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => assign(currentUserId)}
          >
            {isPending ? "Назначаем…" : "Назначить себя ГИПом"}
          </Button>
        ) : null}

        {availableEmployees.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="gip-select">Добавить ещё ГИП</Label>
            <Select
              value={selected || null}
              onValueChange={(value) => setSelected(value ?? "")}
              items={availableEmployees.map((employee) => ({
                value: employee.id,
                label: employee.fullName,
              }))}
            >
              <SelectTrigger id="gip-select" className="w-full">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {availableEmployees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !selected}>
            {isPending ? "Сохраняем…" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
