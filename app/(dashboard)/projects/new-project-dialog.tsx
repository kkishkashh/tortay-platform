"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { createProjectAction } from "@/lib/projects/actions";
import { SECTION_TEMPLATES } from "@/lib/projects/section-templates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type Employee = {
  id: string;
  fullName: string;
};

type NewProjectDialogProps = {
  employees: Employee[];
};

export function NewProjectDialog({ employees }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createProjectAction(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Новый проект
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название проекта</Label>
            <Input id="name" name="name" required autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gipUserId">ГИП</Label>
            <Select
              name="gipUserId"
              required
              items={employees.map((employee) => ({
                value: employee.id,
                label: employee.fullName,
              }))}
            >
              <SelectTrigger id="gipUserId" className="w-full">
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

          <div className="space-y-2">
            <Label>Шаблон разделов</Label>
            <div className="grid grid-cols-2 gap-2">
              {SECTION_TEMPLATES.map((template) => (
                <label
                  key={template.code}
                  className="flex items-center gap-2 text-sm"
                  title={template.label}
                >
                  <Checkbox name="sectionTemplates" value={template.code} />
                  {template.code}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalAmount">
              Стоимость договора (необязательно)
            </Label>
            <Input
              id="totalAmount"
              name="totalAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Например, 5000000"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Создаём…" : "Создать"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
