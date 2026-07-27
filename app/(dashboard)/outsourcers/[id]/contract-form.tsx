"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateOutsourcerContractDetailsAction } from "@/lib/outsourcers/actions";
import { cn } from "@/lib/utils";

type OutsourcerContractInitial = {
  id: string;
  iin: string | null;
  address: string | null;
  bankName: string | null;
  bankKbe: string | null;
  bankAccountNumber: string | null;
  bankBik: string | null;
  idCardNumber: string | null;
  idCardIssuedAt: Date | null;
  idCardIssuedBy: string | null;
  projectSubject: string | null;
  durationDays: number | null;
  totalAmount: number | null;
  paymentPercent1: number | null;
  paymentPercent2: number | null;
  paymentPercent3: number | null;
  contractNumber: string | null;
};

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

const PAYMENT_PRESETS: { label: string; percents: [number, number, number] }[] = [
  { label: "60 / 20 / 20", percents: [60, 20, 20] },
  { label: "40 / 30 / 30", percents: [40, 30, 30] },
];

// Одна форма закрывает и сохранение данных, и генерацию файла: сабмит
// сначала сохраняет поля через server action (присваивая номер/дату
// договора при первом сохранении), и только при успехе переходит на
// route handler, который отдаёт готовый .docx на скачивание.
export function OutsourcerContractForm({ outsourcer }: { outsourcer: OutsourcerContractInitial }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [percent1, setPercent1] = useState(outsourcer.paymentPercent1 ?? 60);
  const [percent2, setPercent2] = useState(outsourcer.paymentPercent2 ?? 20);
  const [percent3, setPercent3] = useState(outsourcer.paymentPercent3 ?? 20);
  const percentSum = percent1 + percent2 + percent3;
  const sumIsValid = percentSum === 100;

  function applyPreset(percents: [number, number, number]) {
    setPercent1(percents[0]);
    setPercent2(percents[1]);
    setPercent3(percents[2]);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateOutsourcerContractDetailsAction(formData);
        window.location.href = `/api/outsourcers/${outsourcer.id}/contract`;
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Договор подряда</CardTitle>
        <p className="text-xs text-muted-foreground">
          {outsourcer.contractNumber
            ? `Номер договора: ${outsourcer.contractNumber}`
            : "Номер и дата договора будут присвоены автоматически при первом сохранении."}
        </p>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={outsourcer.id} />

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="projectSubject">Предмет договора (название и описание объекта)</Label>
            <Textarea
              id="projectSubject"
              name="projectSubject"
              rows={3}
              placeholder="Разработка рабочего проекта для строительства..."
              defaultValue={outsourcer.projectSubject ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="durationDays">Срок выполнения, дней</Label>
            <Input
              id="durationDays"
              name="durationDays"
              type="number"
              min="1"
              defaultValue={outsourcer.durationDays ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalAmount">Общая стоимость, ₸</Label>
            <Input
              id="totalAmount"
              name="totalAmount"
              type="number"
              min="0"
              step="1000"
              defaultValue={outsourcer.totalAmount ?? ""}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
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
              <div className="space-y-1">
                <Label htmlFor="paymentPercent1" className="text-xs text-muted-foreground">
                  1-й транш
                </Label>
                <Input
                  id="paymentPercent1"
                  name="paymentPercent1"
                  type="number"
                  min="0"
                  max="100"
                  value={percent1}
                  onChange={(event) => setPercent1(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="paymentPercent2" className="text-xs text-muted-foreground">
                  2-й транш
                </Label>
                <Input
                  id="paymentPercent2"
                  name="paymentPercent2"
                  type="number"
                  min="0"
                  max="100"
                  value={percent2}
                  onChange={(event) => setPercent2(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="paymentPercent3" className="text-xs text-muted-foreground">
                  3-й транш
                </Label>
                <Input
                  id="paymentPercent3"
                  name="paymentPercent3"
                  type="number"
                  min="0"
                  max="100"
                  value={percent3}
                  onChange={(event) => setPercent3(Number(event.target.value))}
                />
              </div>
            </div>
            <p className={cn("text-xs", sumIsValid ? "text-muted-foreground" : "text-destructive")}>
              Сумма: {percentSum}% {sumIsValid ? "" : "— должна быть ровно 100%"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="iin">ИИН исполнителя</Label>
            <Input id="iin" name="iin" defaultValue={outsourcer.iin ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Адрес исполнителя</Label>
            <Input id="address" name="address" defaultValue={outsourcer.address ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idCardNumber">№ удостоверения личности</Label>
            <Input id="idCardNumber" name="idCardNumber" defaultValue={outsourcer.idCardNumber ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idCardIssuedAt">Дата выдачи удостоверения</Label>
            <Input
              id="idCardIssuedAt"
              name="idCardIssuedAt"
              type="date"
              defaultValue={toDateInputValue(outsourcer.idCardIssuedAt)}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="idCardIssuedBy">Кем выдано удостоверение</Label>
            <Input
              id="idCardIssuedBy"
              name="idCardIssuedBy"
              placeholder="МВД РК"
              defaultValue={outsourcer.idCardIssuedBy ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankName">Банк исполнителя</Label>
            <Input
              id="bankName"
              name="bankName"
              placeholder='АО "Народный Банк Казахстана"'
              defaultValue={outsourcer.bankName ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankKbe">КБе</Label>
            <Input id="bankKbe" name="bankKbe" defaultValue={outsourcer.bankKbe ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankAccountNumber">Номер счёта (ИИК)</Label>
            <Input
              id="bankAccountNumber"
              name="bankAccountNumber"
              defaultValue={outsourcer.bankAccountNumber ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankBik">БИК банка</Label>
            <Input id="bankBik" name="bankBik" defaultValue={outsourcer.bankBik ?? ""} required />
          </div>

          {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending || !sumIsValid}>
              <Download className="size-4" />
              {isPending ? "Сохраняем…" : "Сохранить и скачать договор"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
