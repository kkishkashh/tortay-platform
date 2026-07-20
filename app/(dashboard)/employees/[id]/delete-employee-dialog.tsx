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

export function DeleteEmployeeDialog({
  userId,
  fullName,
}: {
  userId: string;
  fullName: string;
}) {
  const [open, setOpen] = useState(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" />}>
        <Trash2 className="size-4" />
        Удалить
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить сотрудника «{fullName}»?</DialogTitle>
          <DialogDescription>
            Аккаунт и участие во всех проектах удалятся безвозвратно. Если у
            сотрудника есть договоры, подписи или документы в системе —
            удаление будет заблокировано, пока их не переназначат.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter showCloseButton>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Удаляем…" : "Удалить безвозвратно"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
