"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutsourcerFunctionsPicker } from "@/components/outsourcers/outsourcer-functions-picker";
import type { OutsourcerFunctionItem } from "@/lib/outsourcer-functions/queries";
import { updateOutsourcerFunctionsAction } from "@/lib/outsourcers/actions";

export function OutsourcerFunctionsForm({
  outsourcerId,
  functions,
  selectedIds,
}: {
  outsourcerId: string;
  functions: OutsourcerFunctionItem[];
  selectedIds: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const functionIds = formData.getAll("functionIds") as string[];
        await updateOutsourcerFunctionsAction(outsourcerId, functionIds);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Функции</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-3">
          <OutsourcerFunctionsPicker functions={functions} defaultSelectedIds={selectedIds} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Сохраняем…" : saved ? <CheckCircle2 className="size-4" /> : "Сохранить"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
