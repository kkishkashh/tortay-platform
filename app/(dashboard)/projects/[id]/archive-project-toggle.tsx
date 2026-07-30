"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";

import { archiveProjectAction, unarchiveProjectAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";

// Обратимая альтернатива удалению (Task 1.2) — тот же паттерн "мгновенная
// кнопка без диалога", что и у ArchiveEmployeeToggle: действие безопасно
// отменить, лишнее подтверждение здесь только мешало бы.
export function ArchiveProjectToggle({ projectId, isArchived }: { projectId: string; isArchived: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => {
      const action = isArchived ? unarchiveProjectAction : archiveProjectAction;
      action(projectId).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить статус");
      });
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleToggle} disabled={isPending}>
      {isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
      {isArchived ? "Восстановить" : "В архив"}
    </Button>
  );
}
