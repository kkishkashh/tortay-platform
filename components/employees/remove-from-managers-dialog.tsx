"use client";

import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";

import { removeFromAllManagedDepartmentsAction } from "@/lib/managers/actions";
import { updatePositionAction } from "@/lib/employees/actions";
import { assignGipAction, removeGipAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PositionItem } from "@/lib/positions/queries";

const NO_POSITION = "__none__";

// Безопасная альтернатива DeleteManagerDialog — снимает с руководства ВСЕМИ
// департаментами (человек становится обычным сотрудником), аккаунт и
// данные не трогает (см. lib/managers/actions.ts::
// removeFromAllManagedDepartmentsAction — почему это отдельная кнопка, а
// не единственный вариант "Удалить безвозвратно").
//
// По прямой просьбе (2026-08-05): раз человека понижают, тут же предлагаем
// сразу решить его новую роль — сменить должность и/или сделать ГИПом
// каких-то проектов. "Лид" сюда не входит — это производный статус (см.
// lib/leads/queries.ts::isLead), не назначается напрямую этому человеку.
export function RemoveFromManagersDialog({
  userId,
  fullName,
  currentPosition,
  positions,
  gipPickerProjects,
  currentGipProjectIds,
}: {
  userId: string;
  fullName: string;
  currentPosition: string | null;
  positions: PositionItem[];
  gipPickerProjects: { id: string; name: string }[];
  currentGipProjectIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(currentPosition ?? "");
  const [checkedProjects, setCheckedProjects] = useState(new Set(currentGipProjectIds));

  function toggleProject(projectId: string) {
    const next = new Set(checkedProjects);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    setCheckedProjects(next);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await removeFromAllManagedDepartmentsAction(userId);

        if (position !== (currentPosition ?? "")) {
          await updatePositionAction(userId, position || null);
        }

        const initial = new Set(currentGipProjectIds);
        const toAdd = [...checkedProjects].filter((id) => !initial.has(id));
        const toRemove = [...initial].filter((id) => !checkedProjects.has(id));
        await Promise.all([
          ...toAdd.map((projectId) => assignGipAction(projectId, userId)),
          ...toRemove.map((projectId) => removeGipAction(projectId, userId)),
        ]);

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
            Аккаунт, проекты и вся история остаются как есть, ничего не удаляется. Заодно можно
            сразу решить его новую роль ниже.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-position">Новая должность (необязательно)</Label>
          <Select
            value={position || NO_POSITION}
            onValueChange={(value) => setPosition(value === NO_POSITION ? "" : (value ?? ""))}
            items={[
              { value: NO_POSITION, label: "Без должности" },
              ...positions.map((p) => ({ value: p.name, label: p.name })),
            ]}
          >
            <SelectTrigger id="new-position" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_POSITION}>Без должности</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {gipPickerProjects.length > 0 ? (
          <div className="space-y-2">
            <Label>ГИП каких проектов (необязательно, можно нескольких)</Label>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
              {gipPickerProjects.map((project) => (
                <label key={project.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={checkedProjects.has(project.id)}
                    onCheckedChange={() => toggleProject(project.id)}
                  />
                  <span className="truncate">{project.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter showCloseButton>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Сохраняем…" : "Убрать из руководителей"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
