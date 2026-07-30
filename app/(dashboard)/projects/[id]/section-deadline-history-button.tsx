"use client";

import { useState, useTransition } from "react";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getSectionDeadlineHistoryAction } from "@/lib/projects/actions";
import type { SectionDeadlineChangeItem } from "@/lib/projects/queries";
import { SHIFT_REASON_META } from "@/lib/projects/shift-reasons";

function formatDate(date: Date | null) {
  if (!date) return "не задан";
  return new Date(date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// По прямой просьбе Камилы: "был такой-то срок, не успели, продлили —
// нужна причина продления". Показывает всю историю изменений deadline
// раздела, не только продления — но reason есть только у продлений (см.
// updateSectionDatesAction).
export function SectionDeadlineHistoryButton({ sectionId }: { sectionId: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<SectionDeadlineChangeItem[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && history === null) {
      startTransition(async () => {
        const result = await getSectionDeadlineHistoryAction(sectionId);
        setHistory(result);
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />} title="История изменений срока">
        <History className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>История изменений срока</DialogTitle>
        </DialogHeader>
        {isPending && !history ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : !history || history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Срок ещё не менялся.</p>
        ) : (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            {history.map((item) => (
              <div key={item.id} className="space-y-1 rounded-lg border p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">{formatDate(item.previousDeadline)}</span>
                  {" → "}
                  <span className="font-medium">{formatDate(item.newDeadline)}</span>
                </p>
                {item.reasonCategory ? (
                  <p className="text-sm">
                    Причина: {SHIFT_REASON_META[item.reasonCategory].label}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {SHIFT_REASON_META[item.reasonCategory].external ? "внешняя" : "внутренняя"}
                    </span>
                  </p>
                ) : null}
                {item.comment ? <p className="text-sm text-muted-foreground">{item.comment}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {item.changedByName} · {formatDateTime(item.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
