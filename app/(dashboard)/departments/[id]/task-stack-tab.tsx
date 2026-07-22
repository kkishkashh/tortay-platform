"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  createTaskStackItemAction,
  createTaskStackSubItemAction,
  deleteTaskStackItemAction,
  duplicateTaskStackItemAction,
  reorderTaskStackItemsAction,
  updateTaskStackItemAction,
} from "@/lib/departments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DepartmentTaskStackItem, DepartmentTaskStackSubItem } from "@/lib/departments/queries";

function TaskStackRow({
  item,
  isFirst,
  isLast,
  canManage,
  onMove,
}: {
  item: DepartmentTaskStackSubItem;
  isFirst: boolean;
  isLast: boolean;
  canManage: boolean;
  onMove: (itemId: string, direction: "up" | "down") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTaskStackItemAction(item.id, formData);
        setEditing(false);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить");
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteTaskStackItemAction(item.id);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось удалить");
      }
    });
  }

  function handleDuplicate() {
    setError(null);
    startTransition(async () => {
      try {
        await duplicateTaskStackItemAction(item.id);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось дублировать");
      }
    });
  }

  if (editing) {
    return (
      <form action={handleSave} className="space-y-2 rounded-lg border p-3">
        <Input name="title" defaultValue={item.title} required autoFocus />
        <Input name="description" defaultValue={item.description ?? undefined} placeholder="Описание (необязательно)" />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={isPending}>
            <X className="size-3.5" />
            Отмена
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            <Check className="size-3.5" />
            Сохранить
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.title}</p>
        {item.description ? (
          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(item.id, "up")}
            disabled={isFirst || isPending}
            title="Переместить выше"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(item.id, "down")}
            disabled={isLast || isPending}
            title="Переместить ниже"
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(true)} title="Редактировать">
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDuplicate}
            disabled={isPending}
            title="Дублировать"
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            disabled={isPending}
            title="Удалить"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Форма добавления подпункта (чек-листа) под КОНКРЕТНЫМ пунктом верхнего
// уровня — своё локальное состояние показа/скрытия, отдельное от формы
// добавления самих пунктов верхнего уровня.
function AddSubItemForm({ parentItemId }: { parentItemId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createTaskStackSubItemAction(parentItemId, formData);
        setShowForm(false);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось добавить подпункт");
      }
    });
  }

  if (!showForm) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(true)}>
        <Plus className="size-3.5" />
        Добавить подпункт
      </Button>
    );
  }

  return (
    <form action={handleAdd} className="space-y-2 rounded-lg border border-dashed p-3">
      <Input name="title" placeholder="Название подпункта" required autoFocus />
      <Input name="description" placeholder="Описание (необязательно)" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)} disabled={isPending}>
          Отмена
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Добавляем…" : "Добавить"}
        </Button>
      </div>
    </form>
  );
}

export function TaskStackTab({
  departmentId,
  items,
  canManage,
}: {
  departmentId: string;
  items: DepartmentTaskStackItem[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  function handleAdd(formData: FormData) {
    setAddError(null);
    startTransition(async () => {
      try {
        await createTaskStackItemAction(departmentId, formData);
        setShowAddForm(false);
      } catch (submitError) {
        setAddError(submitError instanceof Error ? submitError.message : "Не удалось добавить пункт");
      }
    });
  }

  function handleMove(itemId: string, direction: "up" | "down") {
    const index = items.findIndex((item) => item.id === itemId);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= items.length) return;

    const next = [...items];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];

    startTransition(async () => {
      await reorderTaskStackItemsAction(departmentId, next.map((item) => item.id));
    });
  }

  // Подпункты переставляются только внутри своего родителя — отдельный
  // обработчик, не смешивается с порядком пунктов верхнего уровня.
  function handleMoveSubItem(parentItem: DepartmentTaskStackItem, subItemId: string, direction: "up" | "down") {
    const subItems = parentItem.subItems;
    const index = subItems.findIndex((sub) => sub.id === subItemId);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= subItems.length) return;

    const next = [...subItems];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];

    startTransition(async () => {
      await reorderTaskStackItemsAction(departmentId, next.map((sub) => sub.id));
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Это шаблон — при создании проекта менеджер отмечает галочками, какие пункты стать реальными задачами (вместе с их подпунктами-чек-листом). Изменения здесь не затрагивают уже созданные проекты.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">В базовом стеке пока нет задач.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="space-y-2">
              <TaskStackRow
                item={item}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                canManage={canManage}
                onMove={handleMove}
              />

              {item.subItems.length > 0 || canManage ? (
                <div className="ml-6 space-y-2 border-l pl-3">
                  {item.subItems.map((sub, subIndex) => (
                    <TaskStackRow
                      key={sub.id}
                      item={sub}
                      isFirst={subIndex === 0}
                      isLast={subIndex === item.subItems.length - 1}
                      canManage={canManage}
                      onMove={(subItemId, direction) => handleMoveSubItem(item, subItemId, direction)}
                    />
                  ))}
                  {canManage ? <AddSubItemForm parentItemId={item.id} /> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canManage ? (
        showAddForm ? (
          <form action={handleAdd} className="space-y-2 rounded-lg border border-dashed p-3">
            <Input name="title" placeholder="Название задачи" required autoFocus />
            <Input name="description" placeholder="Описание (необязательно)" />
            {addError ? <p className="text-sm text-destructive">{addError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddForm(false)} disabled={isPending}>
                Отмена
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Добавляем…" : "Добавить"}
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" onClick={() => setShowAddForm(true)}>
            <Plus className="size-4" />
            Добавить пункт
          </Button>
        )
      ) : null}
    </div>
  );
}
