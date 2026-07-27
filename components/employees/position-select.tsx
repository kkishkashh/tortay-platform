"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPositionAction } from "@/lib/positions/actions";
import type { PositionItem } from "@/lib/positions/queries";

// Список должностей раньше был захардкожен (COMMON_POSITIONS) — теперь
// живёт в БД (см. миграцию add_positions) и растёт через "+ Добавить свою
// должность" прямо здесь, без отдельной админ-страницы: тот же круг людей,
// что создаёт/редактирует сотрудников, может расширить список на месте.
export function PositionSelect({
  id,
  name = "position",
  positions: initialPositions,
  defaultValue,
  required,
}: {
  id: string;
  name?: string;
  positions: PositionItem[];
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [positions, setPositions] = useState(initialPositions);
  const [value, setValue] = useState<string | null>(defaultValue ?? null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const existing = positions.find((p) => p.name === trimmed);
        if (existing) {
          setValue(existing.name);
        } else {
          const created = await createPositionAction(trimmed);
          setPositions((prev) => [...prev, { id: created.id, name: created.name }]);
          setValue(created.name);
        }
        setDraft("");
        setAdding(false);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось добавить должность");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <Select
        name={name}
        value={value}
        onValueChange={(next) => setValue(next as string | null)}
        required={required}
        items={positions.map((p) => ({ value: p.name, label: p.name }))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Выберите должность" />
        </SelectTrigger>
        <SelectContent>
          {positions.map((p) => (
            <SelectItem key={p.id} value={p.name}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Новая должность"
            className="h-8 flex-1 text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={isPending}>
            Добавить
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAdding(false);
              setDraft("");
              setError(null);
            }}
          >
            Отмена
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Добавить свою должность
        </button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
