"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import type { OutsourcerListItem } from "@/lib/outsourcers/queries";
import { getAvatarColor, getInitials } from "@/lib/utils";

export function OutsourcerRow({ outsourcer }: { outsourcer: OutsourcerListItem }) {
  const router = useRouter();
  const hasContract = outsourcer.contractNumber !== null;

  return (
    <TableRow
      className="cursor-pointer transition-colors duration-150"
      onClick={() => router.push(`/outsourcers/${outsourcer.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(outsourcer.id) }}
          >
            {getInitials(outsourcer.organization)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{outsourcer.organization}</p>
            <p className="text-xs text-muted-foreground">0 проектов</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm">{outsourcer.specialization}</TableCell>
      <TableCell>
        <div className="text-sm">{outsourcer.phone}</div>
        <div className="text-xs text-muted-foreground">{outsourcer.email}</div>
      </TableCell>
      <TableCell className="text-sm">{outsourcer.directorName}</TableCell>
      <TableCell>
        {hasContract ? (
          <Badge variant="secondary" className="gap-1.5">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: "#0ca30c" }} />
            {outsourcer.contractNumber}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Нет
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm font-medium text-primary">Редакт.</span>
      </TableCell>
    </TableRow>
  );
}
