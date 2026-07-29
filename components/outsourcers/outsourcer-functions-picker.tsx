"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createOutsourcerFunctionAction } from "@/lib/outsourcer-functions/actions";
import type { OutsourcerFunctionItem } from "@/lib/outsourcer-functions/queries";

// Многоразовый список тегов "что предоставляет аутсорсер" (в основном
// "Лицензия", но растёт через "+ добавить" прямо здесь — тот же паттерн,
// что PositionSelect, только множественный выбор, не одиночный: у одного
// аутсорсера может быть несколько функций сразу.
export function OutsourcerFunctionsPicker({
  name = "functionIds",
  functions: initialFunctions,
  defaultSelectedIds = [],
}: {
  name?: string;
  functions: OutsourcerFunctionItem[];
  defaultSelectedIds?: string[];
}) {
  const [functions, setFunctions] = useState(initialFunctions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(defaultSelectedIds));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const existing = functions.find((f) => f.name === trimmed);
        if (existing) {
          setSelectedIds((prev) => new Set(prev).add(existing.id));
        } else {
          const created = await createOutsourcerFunctionAction(trimmed);
          setFunctions((prev) => [...prev, { id: created.id, name: created.name }]);
          setSelectedIds((prev) => new Set(prev).add(created.id));
        }
        setDraft("");
        setAdding(false);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось добавить функцию");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border p-3">
        {functions.map((fn) => (
          <label key={fn.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selectedIds.has(fn.id)} onCheckedChange={() => toggle(fn.id)} />
            {fn.name}
            {selectedIds.has(fn.id) ? <input type="hidden" name={name} value={fn.id} /> : null}
          </label>
        ))}
        {functions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Функций пока нет — добавьте первую.</p>
        ) : null}
      </div>

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
            placeholder="Новая функция"
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
          Добавить свою функцию
        </button>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
