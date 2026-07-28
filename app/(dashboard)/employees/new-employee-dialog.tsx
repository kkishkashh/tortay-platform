"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";

import { createEmployeeAction } from "@/lib/employees/actions";
import type { PositionItem } from "@/lib/positions/queries";
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
import { PositionSelect } from "@/components/employees/position-select";

export function NewEmployeeDialog({
  isAdmin,
  positions,
}: {
  isAdmin: boolean;
  positions: PositionItem[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createEmployeeAction(formData);
      setOpen(false);
      setShowToast(true);
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
          <UserPlus className="size-4" />
          Новый сотрудник
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Новый сотрудник</DialogTitle>
            <DialogDescription>
              Временный пароль сгенерируется автоматически и придёт на указанный email.
            </DialogDescription>
          </DialogHeader>
          <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fullName">ФИО</Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="Иванов Иван Иванович"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Должность</Label>
              <PositionSelect id="position" positions={positions} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Дата рождения</Label>
              <Input id="birthDate" name="birthDate" type="date" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.kz"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+7 700 123 45 67"
              />
            </div>

            {isAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="systemRole">Системная роль</Label>
                <Select
                  name="systemRole"
                  defaultValue="СОТРУДНИК"
                  items={[
                    { value: "СОТРУДНИК", label: "Сотрудник" },
                    { value: "РУКОВОДИТЕЛЬ", label: "Руководитель" },
                  ]}
                >
                  <SelectTrigger id="systemRole" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="СОТРУДНИК">Сотрудник</SelectItem>
                    <SelectItem value="РУКОВОДИТЕЛЬ">Руководитель</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

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
                {isPending ? "Добавляем…" : "Добавить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <CheckCircle2 className="size-4" />
          Сотрудник добавлен, письмо с паролем отправлено
        </div>
      ) : null}
    </>
  );
}
