"use client";

import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";

import { removeFromAllManagedDepartmentsAction } from "@/lib/managers/actions";
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

// Безопасная альтернатива DeleteManagerDialog — просто снимает с
// руководства ВСЕМИ департаментами (человек становится обычным
// сотрудником), аккаунт и данные не трогает. См. комментарий в
// lib/managers/actions.ts::removeFromAllManagedDepartmentsAction — почему
// это отдельная кнопка, а не единственный вариант "Удалить безвозвратно".
export function RemoveFromManagersDialog({ userId, fullName }: { userId: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      try {
        await removeFromAllManagedDepartmentsAction(userId);
        setOpen(false);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось убрать из руководителей",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />} aria-label="Убрать из руководителей">
        <UserMinus className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Убрать «{fullName}» из руководителей?</DialogTitle>
          <DialogDescription>
            Снимет со всех департаментов, которыми он(а) руководит — станет обычным сотрудником.
            Аккаунт, проекты и вся история остаются как есть, ничего не удаляется.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter showCloseButton>
          <Button onClick={handleRemove} disabled={isPending}>
            {isPending ? "Убираем…" : "Убрать из руководителей"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
