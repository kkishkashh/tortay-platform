"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deleteOutsourcerAction } from "@/lib/outsourcers/actions";
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

export function DeleteOutsourcerDialog({
  outsourcerId,
  organization,
}: {
  outsourcerId: string;
  organization: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteOutsourcerAction(outsourcerId);
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
          <DialogTitle>Удалить подрядчика «{organization}»?</DialogTitle>
          <DialogDescription>Это действие нельзя отменить.</DialogDescription>
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
