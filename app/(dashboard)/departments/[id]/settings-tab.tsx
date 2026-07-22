import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepartmentDetail } from "@/lib/departments/queries";

import { DeleteDepartmentDialog } from "./delete-department-dialog";
import { EditDepartmentDialog } from "./edit-department-dialog";

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
