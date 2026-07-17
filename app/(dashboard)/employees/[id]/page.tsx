import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { getEmployeeById } from "@/lib/employees/queries";
import { getAvatarColor, getInitials } from "@/lib/utils";

const SYSTEM_ROLE_LABELS = {
  РУКОВОДИТЕЛЬ: "Руководитель",
  СОТРУДНИК: "Сотрудник",
} as const;

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployeeById(id);
  if (!employee) {
    notFound();
  }

  return (
    <>
      <PageHeader title={employee.fullName} />
      <div className="p-8">
        <div className="flex items-center gap-4">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(employee.id) }}
          >
            {getInitials(employee.fullName)}
          </span>
          <div>
            <p className="text-lg font-medium">{employee.fullName}</p>
            <p className="text-sm text-muted-foreground">{employee.position ?? "—"}</p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="text-sm">{employee.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Телефон</dt>
            <dd className="text-sm">{employee.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Системная роль</dt>
            <dd className="text-sm">{SYSTEM_ROLE_LABELS[employee.systemRole]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Дата рождения</dt>
            <dd className="text-sm">
              {employee.birthDate
                ? employee.birthDate.toLocaleDateString("ru-RU")
                : "—"}
            </dd>
          </div>
        </dl>

        <p className="mt-8 text-sm text-muted-foreground">
          Проекты и подробная активность появятся здесь на следующих шагах.
        </p>
      </div>
    </>
  );
}
