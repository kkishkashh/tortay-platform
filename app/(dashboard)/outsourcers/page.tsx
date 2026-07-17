import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOutsourcers } from "@/lib/outsourcers/queries";
import { formatTodayLabel } from "@/lib/utils";

import { NewOutsourcerDialog } from "./new-outsourcer-dialog";
import { OutsourcerRow } from "./outsourcer-row";

export default async function OutsourcersPage() {
  const outsourcers = await getOutsourcers();

  return (
    <>
      <PageHeader
        title="Аутсорсеры"
        subtitle={formatTodayLabel(new Date())}
        action={<NewOutsourcerDialog />}
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
                  <TableHead>Ставка</TableHead>
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
