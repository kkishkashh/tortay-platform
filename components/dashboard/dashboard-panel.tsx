import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Общая карточка для квадрантов на дашборде — каждый блок сам себе
// небольшая карточка (границы, фон), но с компактными отступами и без
// лишнего визуального веса, чтобы 4 блока читались единым набором,
// а не отдельными "тяжёлыми" панелями.
export function DashboardPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
