import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ManagersTab } from "@/components/employees/managers-tab";
import { canManageDepartments } from "@/lib/departments/permissions";
import { getDepartments } from "@/lib/departments/queries";
import { getManagers } from "@/lib/managers/queries";
import { formatTodayLabel } from "@/lib/utils";

// Отдельный раздел (не таб в Account Portal) — глобальный админский
// инструмент, а не часть личного кабинета (см. lib/managers/*, ранее
// был вкладкой в components/layout/account-portal.tsx).
export default async function ManagersPage() {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    redirect("/");
  }

  const [managers, departments] = await Promise.all([getManagers(), getDepartments()]);

  return (
    <>
      <PageHeader title="Руководители" subtitle={formatTodayLabel(new Date())} />
      <div className="p-8">
        <ManagersTab managers={managers} departments={departments} />
      </div>
    </>
  );
}
