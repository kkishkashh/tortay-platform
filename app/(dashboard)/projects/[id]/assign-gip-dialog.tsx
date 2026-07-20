"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";

import { assignGipAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Employee = {
  id: string;
  fullName: string;
};

export function AssignGipDialog({
  projectId,
  gipUserId,
  employees,
}: {
  projectId: string;
  gipUserId: string | null;
  employees: Employee[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState(gipUserId ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignGipAction(projectId, selected);
        setOpen(false);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось назначить ГИП",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserPlus className="size-4" />
        {gipUserId ? "Сменить ГИП" : "Назначить ГИП"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{gipUserId ? "Сменить ГИП" : "Назначить ГИП"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="gip-select">Сотрудник</Label>
          <Select
            value={selected || null}
            onValueChange={(value) => setSelected(value ?? "")}
            items={employees.map((employee) => ({
              value: employee.id,
              label: employee.fullName,
            }))}
          >
            <SelectTrigger id="gip-select" className="w-full">
              <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !selected}>
            {isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
