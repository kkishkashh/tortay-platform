"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";

import { createManagerAction, type ManagerFormState } from "@/lib/managers/actions";
import type { DepartmentListItem } from "@/lib/departments/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

// Пароль администратор не вводит и не видит — он генерируется на сервере
// и уходит новому руководителю письмом (см. lib/managers/actions.ts).
const initialState: ManagerFormState = { error: null, successCount: 0 };

export function CreateManagerDialog({ departments }: { departments: DepartmentListItem[] }) {
  const [open, setOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [state, formAction, isPending] = useActionState(createManagerAction, initialState);
  const lastHandledSuccessCount = useRef(state.successCount);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(timer);
  }, [showToast]);

  useEffect(() => {
    if (state.successCount === lastHandledSuccessCount.current) return;
    lastHandledSuccessCount.current = state.successCount;
    setOpen(false);
    setShowToast(true);
  }, [state.successCount]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="sm" />}>
          <UserPlus className="size-4" />
          Новый руководитель
        </DialogTrigger>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Новый руководитель</DialogTitle>
            <DialogDescription>
              Временный пароль сгенерируется автоматически и придёт на указанный email.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manager-fullName">ФИО</Label>
              <Input
                id="manager-fullName"
                name="fullName"
                placeholder="Иванов Иван Иванович"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-email">Email</Label>
              <Input
                id="manager-email"
                name="email"
                type="email"
                placeholder="name@company.kz"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-phone">Телефон</Label>
              <Input id="manager-phone" name="phone" type="tel" placeholder="+7 700 123 45 67" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-position">Должность</Label>
              <Input id="manager-position" name="position" placeholder="Руководитель отдела" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager-username">Логин (необязательно)</Label>
              <Input id="manager-username" name="username" placeholder="ivanov" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manager-departmentId">Департамент (необязательно)</Label>
              <Select name="departmentId" items={departments.map((d) => ({ value: d.id, label: d.name }))}>
                <SelectTrigger id="manager-departmentId" className="w-full">
                  <SelectValue placeholder="Без департамента" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                      {department.managerName ? ` (сейчас: ${department.managerName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}

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
                {isPending ? "Создаём…" : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <CheckCircle2 className="size-4" />
          Руководитель создан, письмо с паролем отправлено
        </div>
      ) : null}
    </>
  );
}
