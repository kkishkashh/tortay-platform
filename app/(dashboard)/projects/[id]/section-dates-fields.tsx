"use client";

import { useState, useTransition } from "react";
import { ShiftReasonCategory } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateSectionDatesAction } from "@/lib/projects/actions";
import { SHIFT_REASON_META, SHIFT_REASON_ORDER } from "@/lib/projects/shift-reasons";

import { SectionDeadlineHistoryButton } from "./section-deadline-history-button";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function SectionDatesFields({
  sectionId,
  startDate,
  deadline,
}: {
  sectionId: string;
  startDate: Date | null;
  deadline: Date | null;
}) {
  const [isPending, startTransition] = useTransition();
  // Значение, которое реально показывается в поле — при отмене диалога
  // причины откатываем обратно на currentDeadline, а не оставляем то, что
  // пользователь успел ввести в <input type="date">.
  const [currentDeadline, setCurrentDeadline] = useState(deadline);
  const [pendingDeadline, setPendingDeadline] = useState<string | null>(null);
  const [reasonCategory, setReasonCategory] = useState<ShiftReasonCategory | "">("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleStartDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value || null;
    startTransition(() => {
      updateSectionDatesAction(sectionId, value, toDateInputValue(currentDeadline) || null);
    });
  }

  function handleDeadlineChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value || null;
    const isExtension = Boolean(currentDeadline && value && new Date(value).getTime() > currentDeadline.getTime());

    if (isExtension) {
      // По прямой просьбе Камилы: продление срока требует причины —
      // спрашиваем её прежде, чем реально сохранить новую дату.
      setPendingDeadline(value);
      return;
    }

    setCurrentDeadline(value ? new Date(value) : null);
    startTransition(() => {
      updateSectionDatesAction(sectionId, toDateInputValue(startDate) || null, value);
    });
  }

  function handleConfirmExtension() {
    if (!reasonCategory) {
      setError("Выберите причину продления");
      return;
    }
    setError(null);
    const value = pendingDeadline;
    startTransition(async () => {
      try {
        await updateSectionDatesAction(
          sectionId,
          toDateInputValue(startDate) || null,
          value,
          reasonCategory,
          comment.trim(),
        );
        setCurrentDeadline(value ? new Date(value) : null);
        setPendingDeadline(null);
        setReasonCategory("");
        setComment("");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось продлить срок");
      }
    });
  }

  function handleCancelExtension() {
    setPendingDeadline(null);
    setReasonCategory("");
    setComment("");
    setError(null);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="date"
        defaultValue={toDateInputValue(startDate)}
        onChange={handleStartDateChange}
        disabled={isPending}
        className="h-8 w-36 text-xs"
        aria-label="Начало раздела"
      />
      <span className="text-xs text-muted-foreground">—</span>
      <Input
        type="date"
        value={toDateInputValue(currentDeadline)}
        onChange={handleDeadlineChange}
        disabled={isPending}
        className="h-8 w-36 text-xs"
        aria-label="Срок раздела"
      />
      <SectionDeadlineHistoryButton sectionId={sectionId} />

      <Dialog open={pendingDeadline !== null} onOpenChange={(next) => !next && handleCancelExtension()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Причина продления срока</DialogTitle>
            <DialogDescription>
              Новый срок позже текущего — укажите причину, это сохранится в истории и в аналитике
              по внешним/внутренним сдвигам.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="extension-reason">Причина</Label>
            <Select
              value={reasonCategory || null}
              onValueChange={(value) => setReasonCategory((value as ShiftReasonCategory) ?? "")}
              items={SHIFT_REASON_ORDER.map((k) => ({ value: k, label: SHIFT_REASON_META[k].label }))}
            >
              <SelectTrigger id="extension-reason" className="w-full">
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_REASON_ORDER.map((k) => (
                  <SelectItem key={k} value={k}>
                    {SHIFT_REASON_META[k].label}
                    {SHIFT_REASON_META[k].external ? " · внешняя" : " · внутренняя"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="extension-comment">Что именно произошло (необязательно)</Label>
            <Textarea
              id="extension-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter showCloseButton>
            <Button variant="secondary" onClick={handleCancelExtension} disabled={isPending}>
              Отмена
            </Button>
            <Button onClick={handleConfirmExtension} disabled={isPending}>
              {isPending ? "Сохраняем…" : "Продлить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
