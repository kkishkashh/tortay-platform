"use client";

import { useState, useTransition } from "react";
import { ProjectRole } from "@prisma/client";
import { UserPlus } from "lucide-react";

import { addProjectMemberAction } from "@/lib/projects/actions";
import { PROJECT_ROLE_LABELS } from "@/lib/projects/status-labels";
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

type Employee = { id: string; fullName: string };

const ROLE_OPTIONS = [
  ProjectRole.ИНЖЕНЕР,
  ProjectRole.ВЕДУЩИЙ_СПЕЦИАЛИСТ,
  ProjectRole.ПОМОЩНИК_ГИП,
  ProjectRole.МЕНЕДЖЕР,
  ProjectRole.ГАП,
  ProjectRole.ГИП,
];

// Для ГИП конкретно есть отдельный AssignGipDialog (позволяет НЕСКОЛЬКО
// ГИП сразу, со своим списком/снятием) — этот диалог для остальных ролей
// участника, включая "добавить себя" любой ролью, не только ГИП.
export function AddProjectMemberDialog({
  projectId,
  employees,
  currentUserId,
}: {
  projectId: string;
  employees: Employee[];
  currentUserId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<ProjectRole>(ProjectRole.ИНЖЕНЕР);
  const [error, setError] = useState<string | null>(null);

  function add(userId: string, role: ProjectRole) {
    setError(null);
    startTransition(async () => {
      try {
        await addProjectMemberAction(projectId, userId, role);
        setOpen(false);
        setSelectedUserId("");
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось добавить участника",
        );
      }
    });
  }

  function handleSubmit() {
    if (!selectedUserId) return;
    add(selectedUserId, selectedRole);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserPlus className="size-4" />
        Добавить участника
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить участника</DialogTitle>
        </DialogHeader>

        {currentUserId ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => add(currentUserId, selectedRole)}
          >
            {isPending ? "Добавляем…" : `Добавить себя (${PROJECT_ROLE_LABELS[selectedRole]})`}
          </Button>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="member-role">Роль в проекте</Label>
          <Select
            value={selectedRole}
            onValueChange={(value) => value && setSelectedRole(value as ProjectRole)}
            items={ROLE_OPTIONS.map((role) => ({ value: role, label: PROJECT_ROLE_LABELS[role] }))}
          >
            <SelectTrigger id="member-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {PROJECT_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="member-select">Сотрудник</Label>
          <Select
            value={selectedUserId || null}
            onValueChange={(value) => setSelectedUserId(value ?? "")}
            items={employees.map((employee) => ({ value: employee.id, label: employee.fullName }))}
          >
            <SelectTrigger id="member-select" className="w-full">
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
          <Button onClick={handleSubmit} disabled={isPending || !selectedUserId}>
            {isPending ? "Добавляем…" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
