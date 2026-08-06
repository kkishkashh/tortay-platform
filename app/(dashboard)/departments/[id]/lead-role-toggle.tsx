"use client";

import { useTransition } from "react";

import { toggleAllowsLeadRoleAction } from "@/lib/departments/actions";
import { Checkbox } from "@/components/ui/checkbox";

export function LeadRoleToggle({ departmentId, allowsLeadRole }: { departmentId: string; allowsLeadRole: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    startTransition(() => {
      toggleAllowsLeadRoleAction(departmentId, checked).catch((error) => {
        alert(error instanceof Error ? error.message : "Не удалось изменить настройку");
      });
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={allowsLeadRole}
        disabled={isPending}
        onCheckedChange={(checked) => handleChange(checked === true)}
      />
      Включить роль «Ведущий архитектор» в этом департаменте
    </label>
  );
}
