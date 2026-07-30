"use client";

import { useTransition } from "react";
import { Power, PowerOff } from "lucide-react";

import { deactivateEmployeeAction, reactivateEmployeeAction } from "@/lib/employees/actions";
import { Button } from "@/components/ui/button";

// Обратимая альтернатива удалению (Task 1.2) — тот же паттерн "мгновенная
// кнопка без диалога", что и у ManagerRowActions в managers-tab.tsx:
// действие безопасно отменить, лишнее подтверждение здесь только мешало бы.
export function ArchiveEmployeeToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => {
      const action = isActive ? deactivateEmployeeAction : reactivateEmployeeAction;
      action(userId).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить статус");
      });
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleToggle} disabled={isPending}>
      {isActive ? <PowerOff className="size-4" /> : <Power className="size-4" />}
      {isActive ? "В архив" : "Восстановить"}
    </Button>
  );
}
