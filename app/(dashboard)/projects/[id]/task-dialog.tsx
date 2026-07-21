"use client";

import { ReactNode, useState, useTransition } from "react";
import { TaskPriority } from "@prisma/client";

import { createTaskAction, updateTaskAction } from "@/lib/tasks/actions";
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
import { TASK_PRIORITY_LABELS } from "@/lib/projects/status-labels";
import { UNASSIGNED_MEMBER_VALUE } from "@/lib/tasks/constants";

const PRIORITY_OPTIONS = [
  TaskPriority.НИЗКИЙ,
  TaskPriority.СРЕДНИЙ,
  TaskPriority.ВЫСОКИЙ,
  TaskPriority.СРОЧНЫЙ,
];

const UNASSIGNED = UNASSIGNED_MEMBER_VALUE;

type ProjectMemberOption = { id: string; fullName: string };

type TaskDefaults = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  deadline: Date | null;
  assigneeMemberId: string | null;
};

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function TaskDialog({
  trigger,
  projectMembers,
  mode,
  sectionId,
  taskId,
  defaults,
}: {
  trigger: ReactNode;
  projectMembers: ProjectMemberOption[];
} & (
  | { mode: "create"; sectionId: string; taskId?: undefined; defaults?: undefined }
  | { mode: "edit"; taskId: string; sectionId?: undefined; defaults: TaskDefaults }
)) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createTaskAction(sectionId, formData);
        } else {
          await updateTaskAction(taskId, formData);
        }
        setOpen(false);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось сохранить задачу",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Новая задача" : "Редактировать задачу"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Название</Label>
            <Input id="title" name="title" defaultValue={defaults?.title} required autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание (необязательно)</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={defaults?.description ?? undefined}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Приоритет</Label>
              <Select
                name="priority"
                defaultValue={defaults?.priority ?? TaskPriority.СРЕДНИЙ}
                items={PRIORITY_OPTIONS.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
              >
                <SelectTrigger id="priority" className="w-full">
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
              <Label htmlFor="deadline">Срок</Label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                defaultValue={toDateInputValue(defaults?.deadline ?? null)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigneeMemberId">Исполнитель</Label>
            <Select
              name="assigneeMemberId"
              defaultValue={defaults?.assigneeMemberId ?? UNASSIGNED}
              items={[
                { value: UNASSIGNED, label: "Не назначен" },
                ...projectMembers.map((m) => ({ value: m.id, label: m.fullName })),
              ]}
            >
              <SelectTrigger id="assigneeMemberId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Не назначен</SelectItem>
                {projectMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Сохраняем…" : mode === "create" ? "Создать" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
