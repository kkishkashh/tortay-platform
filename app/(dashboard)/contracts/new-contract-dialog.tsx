"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { createStandaloneContractAction } from "@/lib/contracts/actions";
import { formatTenge } from "@/lib/utils";

type Project = { id: string; name: string };

export function NewContractDialog({
  projects,
  suggestedNumber,
}: {
  projects: Project[];
  suggestedNumber: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const [totalAmount, setTotalAmount] = useState("");
  const [avansAmount, setAvansAmount] = useState("");
  const [tranche2Amount, setTranche2Amount] = useState("");
  const [tranche3Amount, setTranche3Amount] = useState("");

  const trancheSum = useMemo(() => {
    const values = [avansAmount, tranche2Amount, tranche3Amount].map((v) => Number(v) || 0);
    return values.reduce((sum, v) => sum + v, 0);
  }, [avansAmount, tranche2Amount, tranche3Amount]);
  const totalNumber = Number(totalAmount) || 0;
  const sumMatches = totalNumber > 0 && Math.round(trancheSum * 100) === Math.round(totalNumber * 100);

  // 40/40/20 — самая частая на практике разбивка по траншам, поэтому
  // кнопка быстрого заполнения считает её от введённой суммы договора;
  // остаток округления уходит в последний транш (см. тот же принцип в
  // lib/projects/actions.ts::splitIntoTranches).
  function applyStandardSplit() {
    const avans = Math.round(totalNumber * 0.4);
    const tranche2 = Math.round(totalNumber * 0.4);
    const tranche3 = Math.round(totalNumber - avans - tranche2);
    setAvansAmount(String(avans));
    setTranche2Amount(String(tranche2));
    setTranche3Amount(String(tranche3));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createStandaloneContractAction(formData);
        setOpen(false);
        setShowToast(true);
        setTotalAmount("");
        setAvansAmount("");
        setTranche2Amount("");
        setTranche3Amount("");
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось создать договор",
        );
      }
    });
  }

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(timer);
  }, [showToast]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button />}>
          <Plus className="size-4" />
          Новый договор
        </DialogTrigger>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Новый договор</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="number">№ Договора</Label>
              <Input id="number" name="number" defaultValue={suggestedNumber} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Проект</Label>
              <Select
                name="projectId"
                required
                items={projects.map((project) => ({ value: project.id, label: project.name }))}
              >
                <SelectTrigger id="projectId" className="w-full">
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName">Клиент</Label>
              <Input
                id="clientName"
                name="clientName"
                placeholder='ТОО "Заказчик"'
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Сумма договора, ₸</Label>
              <Input
                id="totalAmount"
                name="totalAmount"
                type="number"
                min="0"
                step="1000"
                placeholder="10000000"
                value={totalAmount}
                onChange={(event) => setTotalAmount(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="binIin">БИН клиента</Label>
              <Input id="binIin" name="binIin" placeholder="123456789012" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber">Расчётный счёт</Label>
              <Input
                id="accountNumber"
                name="accountNumber"
                placeholder="KZ12345678901234567890"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bankName">Банк</Label>
              <Input id="bankName" name="bankName" placeholder="Halyk Bank" />
            </div>

            <div className="sm:col-span-2">
              <div className="mb-2 flex items-baseline justify-between">
                <Label className="mb-0">График платежей</Label>
                <span
                  className="text-xs"
                  style={{ color: sumMatches ? "#0ca30c" : "#d03b3b" }}
                >
                  Сумма траншей: {formatTenge(trancheSum)}
                  {totalNumber > 0 ? (sumMatches ? " ✓" : ` (нужно ${formatTenge(totalNumber)})`) : ""}
                </span>
              </div>
              <div className="mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyStandardSplit}
                  disabled={totalNumber <= 0}
                >
                  40 / 40 / 20
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2 rounded-lg border p-3">
                  <Label htmlFor="avansAmount" className="text-xs">
                    Аванс, ₸
                  </Label>
                  <Input
                    id="avansAmount"
                    name="avansAmount"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="3000000"
                    value={avansAmount}
                    onChange={(event) => setAvansAmount(event.target.value)}
                    required
                  />
                  <Label htmlFor="avansDueDate" className="text-xs">
                    Срок
                  </Label>
                  <Input id="avansDueDate" name="avansDueDate" type="date" />
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <Label htmlFor="tranche2Amount" className="text-xs">
                    2-й транш, ₸
                  </Label>
                  <Input
                    id="tranche2Amount"
                    name="tranche2Amount"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="4000000"
                    value={tranche2Amount}
                    onChange={(event) => setTranche2Amount(event.target.value)}
                    required
                  />
                  <Label htmlFor="tranche2DueDate" className="text-xs">
                    Срок
                  </Label>
                  <Input id="tranche2DueDate" name="tranche2DueDate" type="date" />
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <Label htmlFor="tranche3Amount" className="text-xs">
                    3-й транш, ₸
                  </Label>
                  <Input
                    id="tranche3Amount"
                    name="tranche3Amount"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="3000000"
                    value={tranche3Amount}
                    onChange={(event) => setTranche3Amount(event.target.value)}
                    required
                  />
                  <Label htmlFor="tranche3DueDate" className="text-xs">
                    Срок
                  </Label>
                  <Input id="tranche3DueDate" name="tranche3DueDate" type="date" />
                </div>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-destructive sm:col-span-2">{error}</p>
            ) : null}

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Создаём…" : "Создать договор"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <CheckCircle2 className="size-4" />
          Договор создан
        </div>
      ) : null}
    </>
  );
}
