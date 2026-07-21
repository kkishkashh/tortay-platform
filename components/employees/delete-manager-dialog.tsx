"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteManagerAction } from "@/lib/managers/actions";
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

export function DeleteManagerDialog({ userId, fullName }: { userId: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteManagerAction(userId);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось удалить руководителя",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />} aria-label="Удалить">
        <Trash2 className="size-4 text-destructive" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить руководителя «{fullName}»?</DialogTitle>
          <DialogDescription>
            Аккаунт и участие во всех проектах удалятся безвозвратно, департамент останется без
            руководителя. Если у него есть договоры, подписи или документы в системе — удаление
            будет заблокировано, пока их не переназначат.
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
