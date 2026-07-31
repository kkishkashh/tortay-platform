import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepartmentDetail } from "@/lib/departments/queries";

import { DeleteDepartmentDialog } from "./delete-department-dialog";
import { EditDepartmentDialog } from "./edit-department-dialog";
import { LeadRoleToggle } from "./lead-role-toggle";

export function SettingsTab({ department }: { department: DepartmentDetail }) {
  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Название, код и оформление</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Название, код, цвет, иконка и описание департамента.
          </p>
          <EditDepartmentDialog department={department} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Роль «Лид»</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Промежуточный уровень между руководителем департамента и рядовыми сотрудниками:
            руководитель сможет назначать Лидов на вкладке «Структура», а Лид — назначать задачи
            только сотрудникам своей команды.
          </p>
          <LeadRoleToggle departmentId={department.id} allowsLeadRole={department.allowsLeadRole} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Удаление департамента</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Сотрудники будут отвязаны (не удалены), разделы существующих проектов останутся без
            департамента, базовый стек задач удалится безвозвратно. Действие необратимо.
          </p>
          <DeleteDepartmentDialog departmentId={department.id} name={department.name} />
        </CardContent>
      </Card>
    </div>
  );
}
