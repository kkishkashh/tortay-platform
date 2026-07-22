"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { TaskPriority } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPersonalTaskAction } from "@/lib/personal-tasks/actions";
import { TASK_PRIORITY_LABELS } from "@/lib/projects/status-labels";

const PRIORITY_OPTIONS = [
  TaskPriority.НИЗКИЙ,
  TaskPriority.СРЕДНИЙ,
  TaskPriority.ВЫСОКИЙ,
  TaskPriority.СРОЧНЫЙ,
];

export function NewPersonalTaskDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createPersonalTaskAction(formData);
        setOpen(false);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось создать задачу");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Новая задача
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Новая личная задача</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personal-title">Название</Label>
            <Input id="personal-title" name="title" required autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personal-description">Описание (необязательно)</Label>
            <Textarea id="personal-description" name="description" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="personal-priority">Приоритет</Label>
              <Select
                name="priority"
                defaultValue={TaskPriority.СРЕДНИЙ}
                items={PRIORITY_OPTIONS.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
              >
                <SelectTrigger id="personal-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="personal-deadline">Срок (необязательно)</Label>
              <Input id="personal-deadline" name="deadline" type="date" />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Создаём…" : "Создать"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
