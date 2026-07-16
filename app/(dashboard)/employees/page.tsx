import { SystemRole } from "@prisma/client";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEmployees } from "@/lib/employees/queries";

import { NewEmployeeDialog } from "./new-employee-dialog";

const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  [SystemRole.РУКОВОДИТЕЛЬ]: "Руководитель",
  [SystemRole.СОТРУДНИК]: "Сотрудник",
};

export default async function EmployeesPage() {
  const [session, employees] = await Promise.all([auth(), getEmployees()]);

  const canAddEmployees = session?.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

  return (
    <>
      <PageHeader
        title="Сотрудники"
        action={canAddEmployees ? <NewEmployeeDialog /> : undefined}
      />
      <div className="p-8">
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Сотрудников пока нет.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Должность</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Системная роль</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.fullName}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.position ?? "—"}</TableCell>
                  <TableCell>{employee.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {SYSTEM_ROLE_LABELS[employee.systemRole]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
