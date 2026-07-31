"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";

import { addDepartmentManagerAction } from "@/lib/departments/actions";
import type { DepartmentListItem, ManagerCandidate } from "@/lib/departments/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxClear,
  ComboboxCollection,
  ComboboxContent,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PickerItem = { value: string; label: string; sublabel?: string };
type PickerGroup = { label: string | null; items: PickerItem[] };

function comboboxFilter(item: PickerItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.label.toLowerCase().includes(q) || (item.sublabel?.toLowerCase().includes(q) ?? false);
}

// Назначает руководителем СУЩЕСТВУЮЩЕГО сотрудника — не создаёт нового
// человека (см. lib/managers/actions.ts::createManagerAction, который
// раньше и делал именно это: заводил нового User с логином/паролем по
// email, даже когда нужно было просто повысить уже работающего сотрудника).
// Для реально нового человека — обычная форма "Новый сотрудник" на
// странице /employees, а сюда он попадает уже существующим кандидатом.
export function CreateManagerDialog({
  departments,
  employeeCandidates,
}: {
  departments: DepartmentListItem[];
  employeeCandidates: ManagerCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [pickerResetKey, setPickerResetKey] = useState(0);

  const alreadyManaging = employeeCandidates.filter((c) => c.managedDepartmentNames.length > 0);
  const plainStaff = employeeCandidates.filter((c) => c.managedDepartmentNames.length === 0);

  const toPickerItem = (c: ManagerCandidate): PickerItem => ({
    value: c.id,
    label: c.fullName,
    sublabel:
      c.managedDepartmentNames.length > 0
        ? `Руководит: ${c.managedDepartmentNames.join(", ")}`
        : (c.position ?? undefined),
  });

  const employeeGroups: PickerGroup[] = [
    ...(alreadyManaging.length > 0
      ? [{ label: "Уже руководят департаментом", items: alreadyManaging.map(toPickerItem) }]
      : []),
    ...(plainStaff.length > 0 ? [{ label: "Сотрудники", items: plainStaff.map(toPickerItem) }] : []),
  ];

  function handleSubmit() {
    if (!employeeId || !departmentId) return;
    setError(null);
    startTransition(async () => {
      try {
        await addDepartmentManagerAction(departmentId, employeeId);
        setOpen(false);
        setShowToast(true);
        setEmployeeId("");
        setDepartmentId("");
        setPickerResetKey((key) => key + 1);
        setTimeout(() => setShowToast(false), 3000);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось назначить руководителя",
        );
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" />}>
          <UserPlus className="size-4" />
          Назначить руководителя
        </DialogTrigger>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Назначить руководителя</DialogTitle>
            <DialogDescription>
              Выберите существующего сотрудника и департамент, которым он будет руководить. У
              департамента может быть несколько руководителей одновременно.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Сотрудник</p>
              <Combobox
                key={pickerResetKey}
                items={employeeGroups}
                onValueChange={(item) => setEmployeeId(item?.value ?? "")}
                itemToStringLabel={(item) => item.label}
                filter={comboboxFilter}
                disabled={isPending}
              >
                <ComboboxInputGroup className="w-full">
                  <ComboboxInput placeholder="Найти сотрудника…" />
                  <ComboboxClear />
                </ComboboxInputGroup>
                <ComboboxContent emptyMessage="Никого не нашлось">
                  {(group: PickerGroup) => (
                    <ComboboxGroup key={group.label ?? "__unlabeled__"} items={group.items}>
                      {group.label ? <ComboboxGroupLabel>{group.label}</ComboboxGroupLabel> : null}
                      <ComboboxCollection>
                        {(item: PickerItem) => (
                          <ComboboxItem key={item.value} value={item}>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate">{item.label}</span>
                              {item.sublabel ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {item.sublabel}
                                </span>
                              ) : null}
                            </div>
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxGroup>
                  )}
                </ComboboxContent>
              </Combobox>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Департамент</p>
              <Select
                value={departmentId || undefined}
                onValueChange={(value) => setDepartmentId(value ?? "")}
                items={departments.map((d) => ({ value: d.id, label: d.name }))}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите департамент" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !employeeId || !departmentId}
              >
                {isPending ? "Назначаем…" : "Назначить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <CheckCircle2 className="size-4" />
          Руководитель назначен
        </div>
      ) : null}
    </>
  );
}
