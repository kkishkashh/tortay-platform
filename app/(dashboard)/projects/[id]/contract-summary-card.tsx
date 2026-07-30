import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AVR_STAGE_LABELS, CONTRACT_STATUS_LABELS } from "@/lib/contracts/labels";
import type { ContractSummary } from "@/lib/contracts/queries";
import { cn } from "@/lib/utils";

// Task 3.1/3.3 (PRD #3 Phase 4) — краткая карточка договора для страницы
// проекта: без сумм, без реквизитов, без истории ЭЦП (это только на
// /contracts, canManageFinance). Видна любому, кто видит проект (та же
// логика, что у ProjectOutsourcersSection).
export function ContractSummaryCard({ summary }: { summary: ContractSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Договор «{summary.number}»</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{CONTRACT_STATUS_LABELS[summary.status]}</Badge>
          <Badge variant="outline">АВР: {AVR_STAGE_LABELS[summary.avrStage]}</Badge>
          <span className="text-xs text-muted-foreground">Оплачено: {summary.percentPaid}%</span>
        </div>

        <div className="flex items-center">
          {summary.stages.map((stage, index) => {
            const isLast = index === summary.stages.length - 1;
            return (
              <div key={stage.key} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold",
                      stage.isDone
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-muted-foreground/30 bg-background text-muted-foreground",
                    )}
                  >
                    {stage.isDone ? <Check className="size-3.5" /> : index + 1}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{stage.label}</span>
                </div>
                {!isLast ? (
                  <div className={cn("mb-4 h-0.5 flex-1", stage.isDone ? "bg-green-600" : "bg-muted")} />
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
