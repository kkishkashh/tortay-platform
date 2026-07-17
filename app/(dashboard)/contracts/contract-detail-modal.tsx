"use client";

import { useTransition } from "react";
import { AvrStage, ContractStatus, PaymentType } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AVR_STAGE_LABELS,
  CONTRACT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/contracts/labels";
import {
  togglePaymentPaidAction,
  updateAvrStageAction,
  updateContractStatusAction,
  updatePaymentAmountAction,
} from "@/lib/contracts/actions";
import type { ContractListItem } from "@/lib/contracts/queries";
import { cn, formatTenge } from "@/lib/utils";

const CONTRACT_STATUS_OPTIONS = [
  ContractStatus.ЧЕРНОВИК,
  ContractStatus.НА_ПРОВЕРКЕ_ГИП,
  ContractStatus.СОГЛАСОВАН,
  ContractStatus.ПОДПИСАН,
  ContractStatus.ЗАКРЫТ,
  ContractStatus.ОТМЕНЁН,
];

const AVR_STAGE_OPTIONS = [
  AvrStage.НЕТ,
  AvrStage.СТАДИЯ_1,
  AvrStage.СТАДИЯ_2,
  AvrStage.ФИНАЛЬНАЯ,
];

const PAYMENT_ORDER = [PaymentType.АВАНС, PaymentType.ТРАНШ_2, PaymentType.ТРАНШ_3];

function formatDate(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function PaymentCard({
  payment,
  canManage,
}: {
  payment: ContractListItem["payments"][number];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isPaid = payment.status === "ОПЛАЧЕНО";

  function commitAmount(event: React.FocusEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (value === String(payment.amount)) return;
    startTransition(() => {
      updatePaymentAmountAction(payment.id, value);
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isPaid && "border-[#0ca30c]/30 bg-[#0ca30c]/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{PAYMENT_TYPE_LABELS[payment.paymentType]}</span>
        {isPaid ? (
          <Badge variant="secondary" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-[#0ca30c]" />
            Оплачен
          </Badge>
        ) : null}
      </div>
      {canManage && !isPaid ? (
        <Input
          type="number"
          min="0"
          step="1000"
          defaultValue={payment.amount}
          onBlur={commitAmount}
          disabled={isPending}
          className="mt-1 h-8 text-base font-semibold tabular-nums"
        />
      ) : (
        <p className="mt-1 text-lg font-semibold tabular-nums">{formatTenge(payment.amount)}</p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {payment.dueDate ? `Срок: ${formatDate(payment.dueDate)}` : "Срок не задан"}
      </p>
      {isPaid && payment.paidAt ? (
        <p className="text-xs text-[#0ca30c]">Оплачен {formatDate(payment.paidAt)}</p>
      ) : null}

      {canManage ? (
        <Button
          type="button"
          size="sm"
          variant={isPaid ? "outline" : "secondary"}
          className="mt-2 w-full"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              togglePaymentPaidAction(payment.id);
            })
          }
        >
          {isPaid ? "Вернуть в ожидание" : "Отметить оплату"}
        </Button>
      ) : null}
    </div>
  );
}

export function ContractDetailModal({
  contract,
  canManage,
  onClose,
}: {
  contract: ContractListItem;
  canManage: boolean;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const remaining = Math.max(contract.totalAmount - contract.paidAmount, 0);
  const sortedPayments = PAYMENT_ORDER.map((type) =>
    contract.payments.find((payment) => payment.paymentType === type),
  ).filter((payment): payment is ContractListItem["payments"][number] => payment !== undefined);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Договор {contract.number}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Клиент</p>
            <p className="mt-1 font-medium">{contract.clientName}</p>
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <p>БИН: {contract.requisites?.binIin ?? "—"}</p>
              <p>р/с: {contract.requisites?.accountNumber ?? "—"}</p>
              <p>Банк: {contract.requisites?.bankName ?? "—"}</p>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Проект</p>
            <p className="mt-1 font-medium">{contract.projectName}</p>
            <p className="mt-2 text-sm tabular-nums text-muted-foreground">
              {formatTenge(contract.totalAmount)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Статус договора</p>
            {canManage ? (
              <Select
                value={contract.status}
                disabled={isPending}
                items={CONTRACT_STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: CONTRACT_STATUS_LABELS[status],
                }))}
                onValueChange={(value) =>
                  value &&
                  startTransition(() => {
                    updateContractStatusAction(contract.id, value as ContractStatus);
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {CONTRACT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary">{CONTRACT_STATUS_LABELS[contract.status]}</Badge>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Статус АВР</p>
            {canManage ? (
              <Select
                value={contract.avrStage}
                disabled={isPending}
                items={AVR_STAGE_OPTIONS.map((stage) => ({
                  value: stage,
                  label: AVR_STAGE_LABELS[stage],
                }))}
                onValueChange={(value) =>
                  value &&
                  startTransition(() => {
                    updateAvrStageAction(contract.id, value as AvrStage);
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVR_STAGE_OPTIONS.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {AVR_STAGE_LABELS[stage]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary">{AVR_STAGE_LABELS[contract.avrStage]}</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {sortedPayments.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} canManage={canManage} />
          ))}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-[#fab219]/10 px-4 py-3">
          <span className="text-sm font-medium">Остаток к получению</span>
          <span className="text-lg font-semibold tabular-nums text-[#c98500]">
            {formatTenge(remaining)}
          </span>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
