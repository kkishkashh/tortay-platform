"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Plus } from "lucide-react";

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
import { createOutsourcerAction } from "@/lib/outsourcers/actions";
import { COMMON_SPECIALIZATIONS } from "@/lib/outsourcers/specializations";

export function NewOutsourcerDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createOutsourcerAction(formData);
        setOpen(false);
        setShowToast(true);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось создать подрядчика",
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
          Новый аутсорсер
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Новый аутсорсер</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="organization">Организация</Label>
              <Input
                id="organization"
                name="organization"
                placeholder='ТОО "ГеоПроект"'
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialization">Специализация</Label>
              <Select
                name="specialization"
                required
                items={COMMON_SPECIALIZATIONS.map((specialization) => ({
                  value: specialization,
                  label: specialization,
                }))}
              >
                <SelectTrigger id="specialization" className="w-full">
                  <SelectValue placeholder="Геодезия" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SPECIALIZATIONS.map((specialization) => (
                    <SelectItem key={specialization} value={specialization}>
                      {specialization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Ставка (за проект), ₸</Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                min="0"
                step="1000"
                placeholder="500000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractNumber">Номер договора (необязательно)</Label>
              <Input
                id="contractNumber"
                name="contractNumber"
                placeholder="ДОГ-АУТ-2026-005"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+7 700 123 45 67"
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="company@company.kz"
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive sm:col-span-2">{error}</p>
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
          Аутсорсер добавлен
        </div>
      ) : null}
    </>
  );
}
