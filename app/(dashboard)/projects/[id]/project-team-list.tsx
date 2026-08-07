"use client";

import { useTransition } from "react";
import { ProjectRole } from "@prisma/client";
import { X } from "lucide-react";

import { removeProjectMemberAction } from "@/lib/projects/actions";
import { PROJECT_ROLE_LABELS } from "@/lib/projects/status-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";

type Member = { id: string; projectRole: ProjectRole; user: { id: string; fullName: string } };

// Список участников проекта, КРОМЕ ГИП (у ГИП свой список/снятие — см.
// AssignGipDialog) — раньше на странице проекта эти роли вообще не были
// видны, только ГИП-бейджи; убрать участника (2026-08-07, по прямой
// просьбе) можно было только удалив весь проект целиком.
export function ProjectTeamList({
  projectId,
  members,
  canManage,
}: {
  projectId: string;
  members: Member[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const nonGipMembers = members.filter((m) => m.projectRole !== ProjectRole.ГИП);
  if (nonGipMembers.length === 0) {
    return null;
  }

  function handleRemove(userId: string) {
    if (!confirm("Убрать этого участника из проекта?")) return;
    startTransition(async () => {
      try {
        await removeProjectMemberAction(projectId, userId);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Не удалось убрать участника");
      }
    });
  }

  return (
    <div className="mb-6 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Команда проекта</p>
      <div className="flex flex-wrap gap-2">
        {nonGipMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-2 rounded-lg border bg-card py-1.5 pr-1.5 pl-2.5"
          >
            <UserAvatar
              avatarUrl={null}
              fullName={member.user.fullName}
              seed={member.user.id}
              className="size-6 text-[10px]"
            />
            <span className="text-sm">{member.user.fullName}</span>
            <Badge variant="secondary" className="text-[11px]">
              {PROJECT_ROLE_LABELS[member.projectRole]}
            </Badge>
            {canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                title="Убрать из проекта"
                disabled={isPending}
                onClick={() => handleRemove(member.user.id)}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
