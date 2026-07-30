"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { TaskPriority } from "@prisma/client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTaskForEmployeeAction } from "@/lib/tasks/actions";
import type { ManageableProjectOption } from "@/lib/projects/queries";
import { TASK_PRIORITY_LABELS } from "@/lib/projects/status-labels";

const PRIORITY_OPTIONS = [
  TaskPriority.НИЗКИЙ,
  TaskPriority.СРЕДНИЙ,
  TaskPriority.ВЫСОКИЙ,
  TaskPriority.СРОЧНЫЙ,
];

// По прямой просьбе Камилы (2026-07-30): с профиля сотрудника — выбрать
// существующий проект и раздел, и создать в нём задачу сразу для этого
// сотрудника, без похода на страницу проекта. Список projects уже
// отфильтрован сервером (getManageableProjectsForTaskCreation) до тех
// проектов/разделов, где у текущего пользователя реально есть право
// создавать задачи — см. lib/tasks/actions.ts::createTaskForEmployeeAction.
export function AddTaskToProjectDialog({
  employeeUserId,
  employeeFullName,
  projects,
}: {
  employeeUserId: string;
  employeeFullName: string;
  projects: ManageableProjectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");

  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);

  function handleProjectChange(value: string | null) {
    setProjectId(value ?? "");
    setSectionId("");
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (!sectionId) {
      setError("Выберите раздел");
      return;
    }
    formData.set("employeeUserId", employeeUserId);
    formData.set("sectionId", sectionId);
    startTransition(async () => {
      try {
        await createTaskForEmployeeAction(formData);
        setOpen(false);
        setProjectId("");
        setSectionId("");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось создать задачу");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-4" />
        Задача в проект
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Новая задача для {employeeFullName}</DialogTitle>
          <DialogDescription>
            Выберите существующий проект и раздел — сотрудник автоматически станет участником
            проекта, если ещё не был.
          </DialogDescription>
        </DialogHeader>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Нет проектов, где у вас есть право создавать задачи.
          </p>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectId">Проект</Label>
              <Select value={projectId || null} onValueChange={handleProjectChange} items={projects.map((p) => ({ value: p.id, label: p.name }))}>
                <SelectTrigger id="projectId" className="w-full">
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sectionId">Раздел</Label>
              <Select
                value={sectionId || null}
                onValueChange={(value) => setSectionId(value ?? "")}
                disabled={!selectedProject}
                items={(selectedProject?.sections ?? []).map((s) => ({ value: s.id, label: s.name }))}
              >
                <SelectTrigger id="sectionId" className="w-full">
                  <SelectValue placeholder={selectedProject ? "Выберите раздел" : "Сначала выберите проект"} />
                </SelectTrigger>
                <SelectContent>
                  {(selectedProject?.sections ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Название задачи</Label>
              <Input id="title" name="title" required autoFocus />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание (необязательно)</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Приоритет</Label>
                <Select
                  name="priority"
                  defaultValue={TaskPriority.СРЕДНИЙ}
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
                <Input id="deadline" name="deadline" type="date" />
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter showCloseButton>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Создаём…" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
