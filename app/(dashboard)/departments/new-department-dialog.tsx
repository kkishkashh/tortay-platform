"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Plus } from "lucide-react";

import { createDepartmentAction } from "@/lib/departments/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { DepartmentFormFields } from "./department-form-fields";

export function NewDepartmentDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createDepartmentAction(formData);
        setOpen(false);
        setShowToast(true);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось создать департамент",
        );
      }
    });
  }

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(timer);
  }, [showToast]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button />}>
          <Plus className="size-4" />
          Создать департамент
        </DialogTrigger>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Новый департамент</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <DepartmentFormFields />

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
                {isPending ? "Создаём…" : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <CheckCircle2 className="size-4" />
          Департамент создан
        </div>
      ) : null}
    </>
  );
}
