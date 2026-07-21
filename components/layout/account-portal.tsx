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
import { ManagersTab } from "@/components/employees/managers-tab";
import type { EmployeeProfile } from "@/lib/employees/queries";
import type { DepartmentListItem } from "@/lib/departments/queries";
import type { ManagerListItem } from "@/lib/managers/queries";

// Всегда работает с СОБСТСТВЕННЫМ профилем (session.user.id) — в отличие
// от /employees/[id], который руководитель может открыть для чужого
// сотрудника. См. план, D13. Таб "Менеджеры" — глобальный админский
// инструмент, а не часть self-профиля (managers/departments приходят
// не-null только для администратора, см. app/(dashboard)/layout.tsx).
export function AccountPortal({
  profile,
  trigger,
  managers,
  departments,
}: {
  profile: EmployeeProfile;
  trigger: ReactNode;
  managers: ManagerListItem[] | null;
  departments: DepartmentListItem[] | null;
}) {
  const [open, setOpen] = useState(false);
  const isHead = profile.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const canManageManagers = managers !== null && departments !== null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className={canManageManagers ? "sm:max-w-[680px]" : "sm:max-w-[520px]"}>
        <DialogHeader>
          <DialogTitle>Мой аккаунт</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Профиль</TabsTrigger>
            <TabsTrigger value="avatar">Аватар</TabsTrigger>
            {canManageManagers ? (
              <TabsTrigger value="managers">Менеджеры</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <ContactForm userId={profile.id} email={profile.email} phone={profile.phone} />
            {isHead ? (
              <DetailsForm
                userId={profile.id}
                fullName={profile.fullName}
                position={profile.position}
                birthDate={profile.birthDate}
                salary={profile.salary}
                systemRole={profile.systemRole}
                isAdmin={isHead}
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

          {canManageManagers ? (
            <TabsContent value="managers" className="mt-4">
              <ManagersTab managers={managers} departments={departments} />
            </TabsContent>
          ) : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
