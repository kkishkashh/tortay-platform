"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

import { createProjectAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DepartmentIcon } from "@/components/departments/department-icon";
import { cn } from "@/lib/utils";

type Employee = {
  id: string;
  fullName: string;
};

type TaskTemplateItem = {
  id: string;
  title: string;
  description: string | null;
};

type DepartmentOption = {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string;
  taskTemplateItems: TaskTemplateItem[];
};

type NewProjectDialogProps = {
  employees: Employee[];
  departments: DepartmentOption[];
};

type DepartmentSelectionState = {
  checked: boolean;
  itemIds: Set<string>;
  customTasks: string[];
};

function emptySelection(): DepartmentSelectionState {
  return { checked: false, itemIds: new Set(), customTasks: [] };
}

function DepartmentPicker({
  department,
  selection,
  onChange,
}: {
  department: DepartmentOption;
  selection: DepartmentSelectionState;
  onChange: (next: DepartmentSelectionState) => void;
}) {
  const [customTaskDraft, setCustomTaskDraft] = useState("");

  function toggleDepartment() {
    onChange({ ...selection, checked: !selection.checked });
  }

  function toggleItem(itemId: string) {
    const nextIds = new Set(selection.itemIds);
    if (nextIds.has(itemId)) {
      nextIds.delete(itemId);
    } else {
      nextIds.add(itemId);
    }
    onChange({ ...selection, itemIds: nextIds });
  }

  function addCustomTask() {
    const title = customTaskDraft.trim();
    if (!title) return;
    onChange({ ...selection, customTasks: [...selection.customTasks, title] });
    setCustomTaskDraft("");
  }

  function removeCustomTask(index: number) {
    onChange({
      ...selection,
      customTasks: selection.customTasks.filter((_, i) => i !== index),
    });
  }

  const payload = JSON.stringify({
    checkedTemplateItemIds: Array.from(selection.itemIds),
    customTaskTitles: selection.customTasks,
  });

  return (
    <div className="overflow-hidden rounded-lg border">
      <label className="flex cursor-pointer items-center gap-3 p-3">
        <Checkbox checked={selection.checked} onCheckedChange={toggleDepartment} />
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: department.color }}
        >
          <DepartmentIcon name={department.icon} className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{department.name}</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            selection.checked && "rotate-180",
          )}
        />
      </label>

      {selection.checked ? (
        <div className="space-y-3 border-t bg-muted/30 p-3">
          {selection.checked && (
            <>
              <input type="hidden" name="departmentIds" value={department.id} />
              <input type="hidden" name={`deptData_${department.id}`} value={payload} />
            </>
          )}

          {department.taskTemplateItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              В базовом стеке этого департамента пока нет задач.
            </p>
          ) : (
            <div className="space-y-1.5">
              {department.taskTemplateItems.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selection.itemIds.has(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  {item.title}
                </label>
              ))}
            </div>
          )}

          {selection.customTasks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selection.customTasks.map((title, index) => (
                <span
                  key={`${title}-${index}`}
                  className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                >
                  {title}
                  <button
                    type="button"
                    onClick={() => removeCustomTask(index)}
                    aria-label={`Убрать задачу «${title}»`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Input
              value={customTaskDraft}
              onChange={(event) => setCustomTaskDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTask();
                }
              }}
              placeholder="+ своя задача"
              className="h-8 flex-1 text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={addCustomTask}>
              Добавить
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NewProjectDialog({ employees, departments }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, DepartmentSelectionState>>({});

  function getSelection(departmentId: string) {
    return selections[departmentId] ?? emptySelection();
  }

  function setSelection(departmentId: string, next: DepartmentSelectionState) {
    setSelections((prev) => ({ ...prev, [departmentId]: next }));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createProjectAction(formData);
        setOpen(false);
        setSelections({});
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось создать проект",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Новый проект
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="name">Название проекта</Label>
            <Input id="name" name="name" required autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gipUserId">ГИП</Label>
            <Select
              name="gipUserId"
              required
              items={employees.map((employee) => ({
                value: employee.id,
                label: employee.fullName,
              }))}
            >
              <SelectTrigger id="gipUserId" className="w-full">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Департаменты и задачи</Label>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Департаментов пока нет.</p>
            ) : (
              <div className="space-y-2">
                {departments.map((department) => (
                  <DepartmentPicker
                    key={department.id}
                    department={department}
                    selection={getSelection(department.id)}
                    onChange={(next) => setSelection(department.id, next)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Договор (необязательно)
            </p>

            <div className="space-y-2">
              <Label htmlFor="clientName">Заказчик</Label>
              <Input id="clientName" name="clientName" placeholder='ТОО "Заказчик"' />
            </div>

            <div className="space-y-2">
              <Label htmlFor="binIin">БИН заказчика</Label>
              <Input id="binIin" name="binIin" placeholder="123456789012" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Стоимость договора</Label>
              <Input
                id="totalAmount"
                name="totalAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Например, 5000000"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Создаём…" : "Создать"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
