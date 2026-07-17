import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import type { UpcomingPayment } from "@/lib/dashboard/queries";
import { cn, formatTenge } from "@/lib/utils";

function formatDueDate(date: Date | null) {
  if (!date) return "Срок не задан";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function UpcomingPayments({ payments }: { payments: UpcomingPayment[] }) {
  return (
    <DashboardPanel title="Предстоящие платежи">
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Платежей в ожидании нет.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Проект / договор</th>
                <th className="pb-2 font-medium">Срок</th>
                <th className="pb-2 text-right font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-2">
                    <div className="font-medium">{payment.projectName}</div>
                    <div className="text-xs text-muted-foreground">
                      {payment.contractNumber ?? "Без номера договора"}
                    </div>
                  </td>
                  <td
                    className={cn(
                      "py-2",
                      payment.isOverdue && "font-medium text-[#d03b3b]",
                    )}
                  >
                    {formatDueDate(payment.dueDate)}
                    {payment.isOverdue ? " · просрочен" : ""}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatTenge(payment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  );
}
