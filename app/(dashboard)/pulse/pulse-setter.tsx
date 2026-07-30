"use client";

import { useState, useTransition } from "react";
import { PulseSignal } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setPulseAction } from "@/lib/pulse/actions";
import { cn } from "@/lib/utils";

export const PULSE_SIGNAL_META: Record<PulseSignal, { emoji: string; label: string; activeClassName: string }> = {
  ЗЕЛЁНЫЙ: { emoji: "🟢", label: "В графике", activeClassName: "border-success bg-success/10 text-success" },
  ЖЁЛТЫЙ: { emoji: "🟡", label: "Есть трение", activeClassName: "border-warning bg-warning/10 text-warning" },
  КРАСНЫЙ: { emoji: "🔴", label: "Нужна помощь", activeClassName: "border-destructive bg-destructive/10 text-destructive" },
};

// Кнопка-диалог для проставления пульса раздела за текущую неделю — по
// клику на любой из трёх сигналов выбирается сигнал, заметка необязательна,
// сохраняем одним действием. Тот же диалоговый паттерн, что и у причины
// продления срока (см. section-dates-fields.tsx).
export function PulseSetter({
  sectionId,
  currentSignal,
  currentNote,
}: {
  sectionId: string;
  currentSignal: PulseSignal | null;
  currentNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [signal, setSignal] = useState<PulseSignal | null>(currentSignal);
  const [note, setNote] = useState(currentNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!signal) {
      setError("Выберите сигнал");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await setPulseAction(sectionId, signal, note.trim());
        setOpen(false);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить пульс");
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSignal(currentSignal);
      setNote(currentNote ?? "");
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={currentSignal ? "outline" : "secondary"} size="sm" />}>
        {currentSignal
          ? `${PULSE_SIGNAL_META[currentSignal].emoji} ${PULSE_SIGNAL_META[currentSignal].label}`
          : "Отметить пульс"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Пульс раздела на этой неделе</DialogTitle>
          <DialogDescription>
            Сигнал состояния раздела вместо ежедневного отчёта — обновляется раз в неделю.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {(Object.keys(PULSE_SIGNAL_META) as PulseSignal[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSignal(key)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors",
                signal === key
                  ? PULSE_SIGNAL_META[key].activeClassName
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="text-xl">{PULSE_SIGNAL_META[key].emoji}</span>
              {PULSE_SIGNAL_META[key].label}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pulse-note">Заметка (необязательно)</Label>
          <Textarea id="pulse-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter showCloseButton>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
