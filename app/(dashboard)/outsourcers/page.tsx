import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOutsourcerFunctions } from "@/lib/outsourcer-functions/queries";
import { getOutsourcers } from "@/lib/outsourcers/queries";
import { canManageFinance } from "@/lib/projects/permissions";
import { formatTodayLabel } from "@/lib/utils";

import { NewOutsourcerDialog } from "./new-outsourcer-dialog";
import { OutsourcerRow } from "./outsourcer-row";

// Финансово-кадровая зона — видна руководителю компании и руководителю
// Административного департамента (см. lib/projects/permissions.ts,
// canManageFinance). Сайдбар пункт тоже скрывает для остальных, это
// подстраховка на случай прямого перехода по ссылке.
export default async function OutsourcersPage() {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    redirect("/");
  }

  const [outsourcers, functions] = await Promise.all([getOutsourcers(), getOutsourcerFunctions()]);

  return (
    <>
      <PageHeader
        title="Аутсорсеры"
        subtitle={formatTodayLabel(new Date())}
        action={<NewOutsourcerDialog functions={functions} />}
      />
      <div className="p-8">
        {outsourcers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Подрядчиков пока нет — добавьте первого.
          </p>
        ) : (
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Организация</TableHead>
                  <TableHead>Специализация</TableHead>
                  <TableHead>Контакт</TableHead>
                  <TableHead>ФИО директора</TableHead>
                  <TableHead>Договор</TableHead>
                  <TableHead className="text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outsourcers.map((outsourcer) => (
                  <OutsourcerRow key={outsourcer.id} outsourcer={outsourcer} />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
