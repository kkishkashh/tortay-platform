"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";

import { assignGipAction } from "@/lib/projects/actions";
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

export function AssignGipDialog({
  projectId,
  gipUserId,
  employees,
  currentUserId,
}: {
  projectId: string;
  gipUserId: string | null;
  employees: Employee[];
  // Для кнопки-быстрого-пути "Назначить себя ГИПом" — null у пользователей
  // без сессии (сюда практически не долетает, диалог и так виден только
  // тем, у кого есть права, но session может отсутствовать в контексте).
  currentUserId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState(gipUserId ?? "");
  const [error, setError] = useState<string | null>(null);

  function assign(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await assignGipAction(projectId, userId);
        setOpen(false);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось назначить ГИП",
        );
      }
    });
  }

  function handleSubmit() {
    if (!selected) return;
    assign(selected);
  }

  const isAlreadyGip = currentUserId != null && currentUserId === gipUserId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserPlus className="size-4" />
        {gipUserId ? "Сменить ГИП" : "Назначить ГИП"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{gipUserId ? "Сменить ГИП" : "Назначить ГИП"}</DialogTitle>
        </DialogHeader>
        {currentUserId && !isAlreadyGip ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => assign(currentUserId)}
          >
            {isPending ? "Назначаем…" : "Назначить себя ГИПом"}
          </Button>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="gip-select">Сотрудник</Label>
          <Select
            value={selected || null}
            onValueChange={(value) => setSelected(value ?? "")}
            items={employees.map((employee) => ({
              value: employee.id,
              label: employee.fullName,
            }))}
          >
            <SelectTrigger id="gip-select" className="w-full">
              <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !selected}>
            {isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
