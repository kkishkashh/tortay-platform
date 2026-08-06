"use client";

import { useEffect, useState, useTransition } from "react";
import { SystemRole } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const NO_DEPARTMENT = "__none__";

// ФИО/должность/дата рождения/департамент — доступны администратору и
// руководителю департамента этого сотрудника. Департамент можно сменить
// на ЛЮБОЙ из компании (не только "свой"/"без департамента") — по прямой
// просьбе Камилы: любой руководитель, открывший карточку сотрудника,
// может целиком перевести его в другой отдел прямо отсюда. Системная
// роль — это смена привилегий, ЗАВЕДОМО только администратору
// (canEditSystemRole); сервер тоже проверяет это отдельно, см.
// lib/employees/actions.ts.
export function DetailsForm({
  userId,
  fullName,
  position,
  birthDate,
  homeDepartmentId,
  departments,
  systemRole,
  canEditSystemRole,
  financeAccess,
  positions,
}: {
  userId: string;
  fullName: string;
  position: string | null;
  birthDate: Date | null;
  homeDepartmentId: string | null;
  departments: { id: string; name: string }[];
  systemRole: SystemRole;
  canEditSystemRole: boolean;
  financeAccess: boolean;
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

        <div className="space-y-1.5">
          <Label htmlFor="details-department">Департамент</Label>
          <Select
            name="homeDepartmentId"
            defaultValue={homeDepartmentId ?? NO_DEPARTMENT}
            items={[
              { value: NO_DEPARTMENT, label: "Без департамента" },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          >
            <SelectTrigger id="details-department" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DEPARTMENT}>Без департамента</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canEditSystemRole ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="details-systemRole">Права доступа</Label>
            <Select
              name="systemRole"
              defaultValue={systemRole}
              items={[
                { value: "СОТРУДНИК", label: "Обычные" },
                { value: "РУКОВОДИТЕЛЬ", label: "Руководитель" },
                { value: "АДМИН", label: "Админ (полный доступ)" },
                {
                  value: "ГЛАВНЫЙ_ТЕХНИЧЕСКИЙ_ДИРЕКТОР",
                  label: "Главный технический директор (полный доступ)",
                },
              ]}
            >
              <SelectTrigger id="details-systemRole" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="СОТРУДНИК">Обычные</SelectItem>
                <SelectItem value="РУКОВОДИТЕЛЬ">Руководитель</SelectItem>
                <SelectItem value="АДМИН">Админ (полный доступ)</SelectItem>
                <SelectItem value="ГЛАВНЫЙ_ТЕХНИЧЕСКИЙ_ДИРЕКТОР">
                  Главный технический директор (полный доступ)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Это не то же самое, что «руководитель департамента» — тем, кто возглавляет отдел,
              назначайте на странице самого департамента. «Руководитель» — создаёт и редактирует
              проекты, сотрудников, департаменты, как и Админ, но БЕЗ аутсорсеров/договоров (если
              не включить чекбокс ниже) и без дашборда по всем проектам компании. «Админ» — полный
              доступ без исключений, как у Камилы.
            </p>
          </div>
        ) : null}

        {canEditSystemRole ? (
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="financeAccess" defaultChecked={financeAccess} />
              Доступ к аутсорсерам и договорам
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Для бухгалтеров и других сотрудников, которым нужны только эти два раздела — без
              полных прав администратора и без назначения руководителем департамента.
            </p>
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
