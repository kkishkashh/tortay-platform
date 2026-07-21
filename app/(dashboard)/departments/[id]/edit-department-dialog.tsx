"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import { updateDepartmentAction } from "@/lib/departments/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DepartmentDetail } from "@/lib/departments/queries";

import { DepartmentFormFields } from "../department-form-fields";

export function EditDepartmentDialog({ department }: { department: DepartmentDetail }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateDepartmentAction(department.id, formData);
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
      <DialogTrigger render={<Button variant="outline" />}>
        <Pencil className="size-4" />
        Редактировать
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Редактировать департамент</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <DepartmentFormFields
            defaults={{
              name: department.name,
              code: department.code,
              color: department.color,
              icon: department.icon,
              description: department.description,
            }}
          />

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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
