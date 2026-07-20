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

export function DeleteProjectDialog({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteProjectAction(projectId);
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
          <DialogTitle>Удалить проект «{name}»?</DialogTitle>
          <DialogDescription>
            Вместе с проектом безвозвратно удалятся все его разделы, задачи,
            договоры, платежи и документы. Это действие нельзя отменить.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Удаляем…" : "Удалить безвозвратно"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
