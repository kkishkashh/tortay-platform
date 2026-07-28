"use client";

import { ReactNode, useState } from "react";
import { SystemRole } from "@prisma/client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarUploadForm } from "@/components/employees/avatar-upload-form";
import { ContactForm } from "@/components/employees/contact-form";
import { DetailsForm } from "@/components/employees/details-form";
import { PasswordForm } from "@/components/employees/password-form";
import type { EmployeeProfile } from "@/lib/employees/queries";
import type { PositionItem } from "@/lib/positions/queries";

// Всегда работает с СОБСТСТВЕННЫМ профилем (session.user.id) — в отличие
// от /employees/[id], который руководитель может открыть для чужого
// сотрудника. См. план, D13. Управление руководителями департаментов —
// отдельный раздел /managers (ранее было табом здесь, вынесено наружу,
// т.к. это глобальный админский инструмент, а не часть self-профиля).
export function AccountPortal({
  profile,
  trigger,
  positions,
}: {
  profile: EmployeeProfile;
  trigger: ReactNode;
  positions: PositionItem[];
}) {
  const [open, setOpen] = useState(false);
  const isHead = profile.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Мой аккаунт</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="avatar">Аватар</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <ContactForm userId={profile.id} email={profile.email} phone={profile.phone} />
            {isHead ? (
              <DetailsForm
                userId={profile.id}
                fullName={profile.fullName}
                position={profile.position}
                birthDate={profile.birthDate}
                systemRole={profile.systemRole}
                canEditSystemRole={isHead}
                positions={positions}
              />
            ) : null}
            <PasswordForm userId={profile.id} isSelf />
          </TabsContent>

          <TabsContent value="avatar" className="mt-4">
            <AvatarUploadForm
              userId={profile.id}
              fullName={profile.fullName}
              avatarUrl={profile.avatarUrl}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
