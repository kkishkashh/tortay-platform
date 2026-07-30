"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteProjectAction } from "@/lib/projects/actions";
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

// Только администратор (см. lib/projects/actions.ts::deleteProjectAction,
// Task 1.2 — раньше это мог и руководитель департамента проекта, теперь
// только он) и только после ввода точного названия — это редкое,
// необратимое действие, обычное "закрыть/убрать проект" теперь
// архивирование (см. ArchiveProjectToggle).
export function HardDeleteProjectDialog({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteProjectAction(projectId);
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
          <DialogTitle>Удалить проект «{name}» безвозвратно?</DialogTitle>
          <DialogDescription>
            Вместе с проектом безвозвратно удалятся все его разделы, задачи, договоры, платежи и
            документы, без возможности восстановления. Чаще всего нужнее «В архив» — она обратима.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-project-name">Введите «{name}», чтобы подтвердить</Label>
          <Input
            id="confirm-project-name"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || confirmText !== name}
          >
            {isPending ? "Удаляем…" : "Удалить безвозвратно"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
