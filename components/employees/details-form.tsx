"use client";

import { useEffect, useState, useTransition } from "react";
import { SystemRole } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { updateEmployeeDetailsAction } from "@/lib/employees/actions";
import type { PositionItem } from "@/lib/positions/queries";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

// ФИО/должность/дата рождения — доступны администратору и руководителю
// департамента этого сотрудника. Системная роль — это смена привилегий,
// ЗАВЕДОМО только администратору (canEditSystemRole); сервер тоже
// проверяет это отдельно, см. lib/employees/actions.ts.
export function DetailsForm({
  userId,
  fullName,
  position,
  birthDate,
  systemRole,
  canEditSystemRole,
  positions,
}: {
  userId: string;
  fullName: string;
  position: string | null;
  birthDate: Date | null;
  systemRole: SystemRole;
  canEditSystemRole: boolean;
  positions: PositionItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateEmployeeDetailsAction(formData);
        setShowToast(true);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить");
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
      <form action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="userId" value={userId} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="details-fullName">ФИО</Label>
          <Input id="details-fullName" name="fullName" defaultValue={fullName} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="details-position">Должность</Label>
          <PositionSelect id="details-position" positions={positions} defaultValue={position} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="details-birthDate">Дата рождения</Label>
          <Input
            id="details-birthDate"
            name="birthDate"
            type="date"
            defaultValue={toDateInputValue(birthDate)}
          />
        </div>

        {canEditSystemRole ? (
          <div className="space-y-1.5">
            <Label htmlFor="details-systemRole">Системная роль</Label>
            <Select
              name="systemRole"
              defaultValue={systemRole}
              items={[
                { value: "СОТРУДНИК", label: "Сотрудник" },
                { value: "РУКОВОДИТЕЛЬ", label: "Руководитель" },
              ]}
            >
              <SelectTrigger id="details-systemRole" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="СОТРУДНИК">Сотрудник</SelectItem>
                <SelectItem value="РУКОВОДИТЕЛЬ">Руководитель</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}

        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </form>

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <CheckCircle2 className="size-4" />
          Данные сотрудника обновлены
        </div>
      ) : null}
    </>
  );
}
