"use client";

import { useState, useTransition } from "react";

import { assignGipAction, removeGipAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Project = { id: string; name: string };

// Обратный путь к тем же assignGipAction/removeGipAction, что и на странице
// проекта (assign-gip-dialog.tsx) — там сначала выбирают проект, потом
// сотрудника; здесь сотрудник уже открыт (это его профиль) — отмечаем
// галочками, ГИПом каких проектов он должен быть, один сотрудник может
// быть ГИПом сразу нескольких проектов одновременно (не ограничено одним).
export function AssignGipFromEmployee({
  employeeUserId,
  projects,
  currentGipProjectIds,
}: {
  employeeUserId: string;
  projects: Project[];
  currentGipProjectIds: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(new Set(currentGipProjectIds));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggle(projectId: string) {
    const next = new Set(checked);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    setChecked(next);
    setSuccess(false);
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        const initial = new Set(currentGipProjectIds);
        const toAdd = [...checked].filter((id) => !initial.has(id));
        const toRemove = [...initial].filter((id) => !checked.has(id));

        await Promise.all([
          ...toAdd.map((projectId) => assignGipAction(projectId, employeeUserId)),
          ...toRemove.map((projectId) => removeGipAction(projectId, employeeUserId)),
        ]);

        setSuccess(true);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить");
      }
    });
  }

  if (projects.length === 0) {
    return null;
  }

  const initial = new Set(currentGipProjectIds);
  const hasChanges =
    checked.size !== initial.size || [...checked].some((id) => !initial.has(id));

  return (
    <div className="space-y-2 border-t pt-3">
      <Label>ГИП каких проектов (можно нескольких сразу)</Label>
      <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2">
        {projects.map((project) => (
          <label key={project.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={checked.has(project.id)}
              onCheckedChange={() => toggle(project.id)}
            />
            <span className="truncate">{project.name}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={isPending || !hasChanges}>
          {isPending ? "Сохраняем…" : "Сохранить"}
        </Button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {success ? <p className="text-xs text-muted-foreground">Готово.</p> : null}
      </div>
    </div>
  );
}
