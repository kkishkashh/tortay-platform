"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteDepartmentAction } from "@/lib/departments/actions";
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

export function DeleteDepartmentDialog({
  departmentId,
  name,
}: {
  departmentId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteDepartmentAction(departmentId);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось удалить департамент",
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
          <DialogTitle>Удалить департамент «{name}»?</DialogTitle>
          <DialogDescription>
            Сотрудники будут отвязаны от департамента (не удалены), разделы уже созданных
            проектов останутся без департамента, а базовый стек задач удалится безвозвратно.
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
