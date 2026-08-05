"use client";

import { useState, useTransition } from "react";

import { assignGipAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Project = { id: string; name: string };

// Обратный путь к тому же assignGipAction, что и на странице проекта
// (assign-gip-dialog.tsx) — там сначала выбирают проект, потом сотрудника;
// здесь сотрудник уже открыт (это его профиль), выбираем проект. По
// прямой просьбе: видно тем же, кто видит карточку "Кадровые данные"
// (см. canEditDetails в employees/[id]/page.tsx).
export function AssignGipFromEmployee({
  employeeUserId,
  projects,
}: {
  employeeUserId: string;
  projects: Project[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleAssign() {
    if (!selected) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await assignGipAction(selected, employeeUserId);
        setSuccess(true);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось назначить ГИП");
      }
    });
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5 border-t pt-3">
      <Label htmlFor="assign-gip-project">Назначить ГИПом проекта</Label>
      <div className="flex gap-2">
        <Select
          value={selected || null}
          onValueChange={(value) => setSelected(value ?? "")}
          items={projects.map((p) => ({ value: p.id, label: p.name }))}
        >
          <SelectTrigger id="assign-gip-project" className="w-full">
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
        <Button type="button" onClick={handleAssign} disabled={isPending || !selected}>
          {isPending ? "Назначаем…" : "Назначить"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {success ? <p className="text-xs text-muted-foreground">Готово — назначен(а) ГИПом.</p> : null}
    </div>
  );
}
