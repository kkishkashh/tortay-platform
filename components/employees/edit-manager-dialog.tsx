"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import { updateManagerAction } from "@/lib/managers/actions";
import type { DepartmentListItem } from "@/lib/departments/queries";
import type { ManagerListItem } from "@/lib/managers/queries";
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

export function EditManagerDialog({
  manager,
  departments,
}: {
  manager: ManagerListItem;
  departments: DepartmentListItem[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateManagerAction(manager.id, formData);
        setOpen(false);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось сохранить изменения",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />} aria-label="Редактировать">
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Редактировать руководителя</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit-manager-fullName-${manager.id}`}>ФИО</Label>
            <Input
              id={`edit-manager-fullName-${manager.id}`}
              name="fullName"
              defaultValue={manager.fullName}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-manager-email-${manager.id}`}>Email</Label>
            <Input
              id={`edit-manager-email-${manager.id}`}
              name="email"
              type="email"
              defaultValue={manager.email}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-manager-phone-${manager.id}`}>Телефон</Label>
            <Input
              id={`edit-manager-phone-${manager.id}`}
              name="phone"
              type="tel"
              defaultValue={manager.phone ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-manager-position-${manager.id}`}>Должность</Label>
            <Input
              id={`edit-manager-position-${manager.id}`}
              name="position"
              defaultValue={manager.position ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-manager-username-${manager.id}`}>Логин</Label>
            <Input
              id={`edit-manager-username-${manager.id}`}
              name="username"
              defaultValue={manager.username ?? ""}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`edit-manager-departmentId-${manager.id}`}>Департамент</Label>
            <Select
              name="departmentId"
              defaultValue={manager.departmentId ?? undefined}
              items={departments.map((d) => ({ value: d.id, label: d.name }))}
            >
              <SelectTrigger id={`edit-manager-departmentId-${manager.id}`} className="w-full">
                <SelectValue placeholder="Без департамента" />
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

          {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
