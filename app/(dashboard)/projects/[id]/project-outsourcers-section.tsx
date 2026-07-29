"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  addOutsourcerToProjectAction,
  removeOutsourcerFromProjectAction,
  toggleTranchePaidAction,
  type ProjectOutsourcerFormState,
} from "@/lib/project-outsourcers/actions";
import type { OutsourcerPickerItem } from "@/lib/project-outsourcers/queries";
import type { ProjectOutsourcerItem } from "@/lib/project-outsourcers/queries";
import { cn, formatTenge } from "@/lib/utils";

const PAYMENT_PRESETS: { label: string; percents: [number, number, number] }[] = [
  { label: "60 / 20 / 20", percents: [60, 20, 20] },
  { label: "40 / 30 / 30", percents: [40, 30, 30] },
];

const initialAddState: ProjectOutsourcerFormState = { error: null, successCount: 0 };

function AddOutsourcerDialog({
  projectId,
  pickerOptions,
}: {
  projectId: string;
  pickerOptions: OutsourcerPickerItem[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addOutsourcerToProjectAction, initialAddState);
  const lastHandledSuccessCount = useRef(state.successCount);
  const [percent1, setPercent1] = useState(60);
  const [percent2, setPercent2] = useState(20);
  const [percent3, setPercent3] = useState(20);
  const percentSum = percent1 + percent2 + percent3;
  const sumIsValid = percentSum === 100;

  useEffect(() => {
    if (state.successCount === lastHandledSuccessCount.current) return;
    lastHandledSuccessCount.current = state.successCount;
    setOpen(false);
  }, [state.successCount]);

  function applyPreset(percents: [number, number, number]) {
    setPercent1(percents[0]);
    setPercent2(percents[1]);
    setPercent3(percents[2]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Добавить аутсорсера
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Добавить аутсорсера в проект</DialogTitle>
          <DialogDescription>
            Выберите уже существующего аутсорсера — новый создаётся отдельно, на странице
            «Аутсорсеры».
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

          <div className="space-y-2">
            <Label htmlFor="outsourcerId">Аутсорсер</Label>
            <Select
              name="outsourcerId"
              required
              items={pickerOptions.map((o) => ({ value: o.id, label: o.organization }))}
            >
              <SelectTrigger id="outsourcerId" className="w-full" type="button">
                <SelectValue placeholder="Выберите аутсорсера" />
              </SelectTrigger>
              <SelectContent>
                {pickerOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.organization}
                    <span className="ml-1 text-xs text-muted-foreground">({o.specialization})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectSubject">Предмет договора</Label>
            <Textarea
              id="projectSubject"
              name="projectSubject"
              rows={2}
              placeholder="Разработка раздела ЭОМ для..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="durationDays">Срок, дней</Label>
              <Input id="durationDays" name="durationDays" type="number" min="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Сумма, ₸</Label>
              <Input id="totalAmount" name="totalAmount" type="number" min="0" step="1000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Разбивка оплаты по траншам, %</Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset.percents)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                name="paymentPercent1"
                type="number"
                min="0"
                max="100"
                value={percent1}
                onChange={(event) => setPercent1(Number(event.target.value))}
              />
              <Input
                name="paymentPercent2"
                type="number"
                min="0"
                max="100"
                value={percent2}
                onChange={(event) => setPercent2(Number(event.target.value))}
              />
              <Input
                name="paymentPercent3"
                type="number"
                min="0"
                max="100"
                value={percent3}
                onChange={(event) => setPercent3(Number(event.target.value))}
              />
            </div>
            <p className={cn("text-xs", sumIsValid ? "text-muted-foreground" : "text-destructive")}>
              Сумма: {percentSum}% {sumIsValid ? "" : "— должна быть ровно 100%"}
            </p>
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending || !sumIsValid}>
              {isPending ? "Добавляем…" : "Добавить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TrancheBadge({
  label,
  percent,
  paid,
  canManage,
  onToggle,
}: {
  label: string;
  percent: number | null;
  paid: boolean;
  canManage: boolean;
  onToggle: () => void;
}) {
  if (!percent) return null;
  const badge = (
    <Badge variant={paid ? "secondary" : "outline"} className={cn("gap-1.5", !paid && "text-muted-foreground")}>
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: paid ? "#0ca30c" : "var(--muted-foreground)" }}
      />
      {label}: {percent}% {paid ? "оплачен" : "не оплачен"}
    </Badge>
  );
  if (!canManage) return badge;
  return (
    <button type="button" onClick={onToggle} className="cursor-pointer">
      {badge}
    </button>
  );
}

function OutsourcerEngagementRow({
  engagement,
  canManage,
}: {
  engagement: ProjectOutsourcerItem;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(tranche: 1 | 2 | 3) {
    setError(null);
    startTransition(async () => {
      try {
        await toggleTranchePaidAction(engagement.id, tranche);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось обновить");
      }
    });
  }

  function remove() {
    if (!confirm(`Убрать «${engagement.organization}» из проекта?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeOutsourcerFromProjectAction(engagement.id);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось убрать");
      }
    });
  }

  const advancePaid = engagement.tranche1Paid;

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/outsourcers/${engagement.outsourcerId}`} className="text-sm font-medium hover:underline">
            {engagement.organization}
          </Link>
          <p className="text-xs text-muted-foreground">
            {engagement.specialization}
            {engagement.functionNames.length > 0 ? ` · ${engagement.functionNames.join(", ")}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Добавил(а): {engagement.addedByName}</p>
        </div>
        <div className="flex items-center gap-2">
          {engagement.totalAmount ? (
            <Badge variant="secondary">{formatTenge(engagement.totalAmount)}</Badge>
          ) : null}
          <Badge
            variant={advancePaid ? "secondary" : "outline"}
            className={cn("gap-1.5", advancePaid ? "text-primary" : "text-destructive")}
          >
            {advancePaid ? <CheckCircle2 className="size-3.5" /> : null}
            {advancePaid ? "Можно начинать работу" : "Ожидает оплаты аванса"}
          </Badge>
          {canManage ? (
            <>
              {engagement.contractNumber ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Скачать договор"
                  disabled={isPending}
                  onClick={() =>
                    window.open(`/api/project-outsourcers/${engagement.id}/contract`, "_blank")
                  }
                >
                  <Download className="size-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Убрать из проекта"
                disabled={isPending}
                onClick={remove}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {engagement.projectSubject ? (
        <p className="text-xs text-muted-foreground">{engagement.projectSubject}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <TrancheBadge
          label="1-й транш"
          percent={engagement.paymentPercent1}
          paid={engagement.tranche1Paid}
          canManage={canManage}
          onToggle={() => toggle(1)}
        />
        <TrancheBadge
          label="2-й транш"
          percent={engagement.paymentPercent2}
          paid={engagement.tranche2Paid}
          canManage={canManage}
          onToggle={() => toggle(2)}
        />
        <TrancheBadge
          label="3-й транш"
          percent={engagement.paymentPercent3}
          paid={engagement.tranche3Paid}
          canManage={canManage}
          onToggle={() => toggle(3)}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function ProjectOutsourcersSection({
  projectId,
  outsourcers,
  pickerOptions,
  canManage,
}: {
  projectId: string;
  outsourcers: ProjectOutsourcerItem[];
  pickerOptions: OutsourcerPickerItem[];
  canManage: boolean;
}) {
  if (outsourcers.length === 0 && !canManage) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Аутсорсеры</CardTitle>
        {canManage ? <AddOutsourcerDialog projectId={projectId} pickerOptions={pickerOptions} /> : null}
      </CardHeader>
      <CardContent>
        {outsourcers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Аутсорсеры пока не привязаны.</p>
        ) : (
          <div className="space-y-3">
            {outsourcers.map((engagement) => (
              <OutsourcerEngagementRow key={engagement.id} engagement={engagement} canManage={canManage} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
