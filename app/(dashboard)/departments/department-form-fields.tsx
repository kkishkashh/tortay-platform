"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DepartmentIcon } from "@/components/departments/department-icon";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DEPARTMENT_COLOR,
  DEFAULT_DEPARTMENT_ICON,
  DEPARTMENT_COLOR_SWATCHES,
  DEPARTMENT_ICON_NAMES,
} from "@/lib/departments/icons";

export type DepartmentFormDefaults = {
  name?: string;
  code?: string;
  color?: string;
  icon?: string;
  description?: string | null;
};

// Общие поля формы департамента (имя/код/цвет/иконка/описание) — общий
// компонент для диалогов создания и редактирования, чтобы не дублировать
// пикер цвета/иконки в двух местах.
export function DepartmentFormFields({ defaults }: { defaults?: DepartmentFormDefaults }) {
  const [color, setColor] = useState(defaults?.color ?? DEFAULT_DEPARTMENT_COLOR);
  const [icon, setIcon] = useState(defaults?.icon ?? DEFAULT_DEPARTMENT_ICON);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Название департамента</Label>
        <Input
          id="name"
          name="name"
          placeholder="Архитектура"
          defaultValue={defaults?.name}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Код</Label>
        <Input
          id="code"
          name="code"
          placeholder="AR"
          defaultValue={defaults?.code}
          className="uppercase"
          maxLength={10}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Описание (необязательно)</Label>
        <Input
          id="description"
          name="description"
          placeholder="Кратко о зоне ответственности"
          defaultValue={defaults?.description ?? undefined}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>Цвет</Label>
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {DEPARTMENT_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              aria-label={swatch}
              className={cn(
                "size-8 rounded-full ring-offset-2 ring-offset-popover transition-all",
                color === swatch ? "ring-2 ring-foreground" : "hover:scale-110",
              )}
              style={{ backgroundColor: swatch }}
            />
          ))}
          <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-border">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="absolute -top-1 -left-1 size-10 cursor-pointer"
              aria-label="Свой цвет"
            />
          </label>
        </div>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label>Иконка</Label>
        <input type="hidden" name="icon" value={icon} />
        <div className="grid grid-cols-9 gap-2 sm:grid-cols-13">
          {DEPARTMENT_ICON_NAMES.map((iconName) => {
            const selected = icon === iconName;
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => setIcon(iconName)}
                aria-label={iconName}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-muted hover:text-foreground",
                )}
              >
                <DepartmentIcon name={iconName} className="size-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
