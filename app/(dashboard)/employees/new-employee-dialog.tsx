"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";

import { createEmployeeAction } from "@/lib/employees/actions";
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

export function NewEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createEmployeeAction(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus className="size-4" />
        Добавить сотрудника
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый сотрудник</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">ФИО</Label>
            <Input id="fullName" name="fullName" required autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" name="password" type="password" required minLength={6} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Должность (необязательно)</Label>
            <Input id="position" name="position" placeholder="Например, инженер-конструктор" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Телефон (необязательно)</Label>
            <Input id="phone" name="phone" type="tel" placeholder="+7 700 000 00 00" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">Дата рождения (необязательно)</Label>
            <Input id="birthDate" name="birthDate" type="date" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemRole">Системная роль</Label>
            <Select name="systemRole" defaultValue="СОТРУДНИК">
              <SelectTrigger id="systemRole" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="СОТРУДНИК">Сотрудник</SelectItem>
                <SelectItem value="РУКОВОДИТЕЛЬ">Руководитель</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Добавляем…" : "Добавить"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
