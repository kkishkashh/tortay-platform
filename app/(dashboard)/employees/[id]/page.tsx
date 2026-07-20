import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { getEmployeeProfile } from "@/lib/employees/queries";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";
import { getAvatarColor, getInitials } from "@/lib/utils";
import { WORKLOAD_META } from "@/lib/workload";
import { FolderKanban, ListChecks, Percent, Gauge } from "lucide-react";

import { ContactForm } from "./contact-form";
import { DeleteEmployeeDialog } from "./delete-employee-dialog";
import { DetailsForm } from "./details-form";
import { PasswordForm } from "./password-form";

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

  const [session, employee] = await Promise.all([auth(), getEmployeeProfile(id)]);
  if (!employee) {
    notFound();
  }

  const isSelf = session?.user.id === employee.id;
  const isHead = session?.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  // Личный кабинет — только свой или (для руководителя) любой чужой.
  if (!isSelf && !isHead) {
    redirect("/employees");
  }

  const canEditContact = isSelf || isHead;
  const canEditDetails = isHead;
  const workloadMeta = WORKLOAD_META[employee.workload];

  return (
    <>
      <PageHeader
        title={employee.fullName}
        action={
          isHead && !isSelf ? (
            <DeleteEmployeeDialog userId={employee.id} fullName={employee.fullName} />
          ) : undefined
        }
      />
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(employee.id) }}
          >
            {getInitials(employee.fullName)}
          </span>
          <div>
            <p className="text-lg font-medium">{employee.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {employee.position ?? "Должность не указана"} ·{" "}
              {SYSTEM_ROLE_LABELS[employee.systemRole]}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Активных проектов"
            value={String(employee.activeProjectsCount)}
            icon={FolderKanban}
          />
          <StatCard
            label="Всего проектов"
            value={String(employee.totalProjectsCount)}
            icon={ListChecks}
          />
          <StatCard
            label="Завершено"
            value={`${employee.completionRate}%`}
            icon={Percent}
          />
          <StatCard label="Загруженность" value={workloadMeta.label} icon={Gauge} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Проекты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {employee.totalProjectsCount === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет проектов.</p>
            ) : (
              employee.projectsByStatus.map(({ status, projects }) =>
                projects.length === 0 ? null : (
                  <div key={status}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                      {PROJECT_STATUS_LABELS[status]}
                    </p>
                    <ul className="space-y-1">
                      {projects.map((project) => (
                        <li key={project.id}>
                          <Link
                            href={`/projects/${project.id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {project.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Личные данные</CardTitle>
          </CardHeader>
          <CardContent>
            {canEditContact ? (
              <ContactForm userId={employee.id} email={employee.email} phone={employee.phone} />
            ) : (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="text-sm">{employee.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Телефон</dt>
                  <dd className="text-sm">{employee.phone ?? "—"}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        {canEditDetails ? (
          <Card>
            <CardHeader>
              <CardTitle>Кадровые данные</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailsForm
                userId={employee.id}
                fullName={employee.fullName}
                position={employee.position}
                birthDate={employee.birthDate}
                salary={employee.salary}
                systemRole={employee.systemRole}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Кадровые данные</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Должность</dt>
                  <dd className="text-sm">{employee.position ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Дата рождения</dt>
                  <dd className="text-sm">
                    {employee.birthDate
                      ? employee.birthDate.toLocaleDateString("ru-RU")
                      : "—"}
                  </dd>
                </div>
                {isSelf && employee.salary !== null ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Оклад</dt>
                    <dd className="text-sm">{employee.salary.toLocaleString("ru-RU")} ₸</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{isSelf ? "Смена пароля" : "Сброс пароля"}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm userId={employee.id} isSelf={Boolean(isSelf)} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
