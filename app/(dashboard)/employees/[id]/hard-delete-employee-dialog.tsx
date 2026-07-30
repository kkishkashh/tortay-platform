"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteEmployeeAction } from "@/lib/employees/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Только администратор (см. lib/employees/actions.ts::deleteEmployeeAction,
// Task 1.2 — раньше это мог и руководитель департамента, теперь только он)
// и только после ввода точного ФИО — это редкое, необратимое действие,
// обычное "убрать сотрудника" теперь архивирование (см. ArchiveEmployeeToggle).
export function HardDeleteEmployeeDialog({
  userId,
  fullName,
}: {
  userId: string;
  fullName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteEmployeeAction(userId);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось удалить сотрудника",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>
        <Trash2 className="size-4" />
        Удалить безвозвратно
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить сотрудника «{fullName}» безвозвратно?</DialogTitle>
          <DialogDescription>
            Аккаунт и участие во всех проектах удалятся без возможности восстановления. Если у
            сотрудника есть договоры, подписи или документы в системе — удаление будет
            заблокировано, пока их не переназначат. Чаще всего нужнее «В архив» — она обратима.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-name">
            Введите «{fullName}», чтобы подтвердить
          </Label>
          <Input
            id="confirm-name"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || confirmText !== fullName}
          >
            {isPending ? "Удаляем…" : "Удалить безвозвратно"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
