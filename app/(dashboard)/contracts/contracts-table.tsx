"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AVR_STAGE_COLORS,
  AVR_STAGE_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
} from "@/lib/contracts/labels";
import type { ContractListItem } from "@/lib/contracts/queries";
import { formatTenge } from "@/lib/utils";

import { ContractDetailModal } from "./contract-detail-modal";

function ProgressCell({ paid, total }: { paid: number; total: number }) {
  const percent = total === 0 ? 0 : Math.min((paid / total) * 100, 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="tabular-nums">{formatTenge(paid)}</span>
        <span className="text-muted-foreground">{Math.round(percent)}%</span>
      </div>
      <div className="h-1.5 w-32 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ContractsTable({
  contracts,
  canManage,
  hasTemplate,
}: {
  contracts: ContractListItem[];
  canManage: boolean;
  hasTemplate: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = contracts.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>№ Договора</TableHead>
            <TableHead>Клиент / Проект</TableHead>
            <TableHead>Сумма</TableHead>
            <TableHead>Оплачено</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>АВР</TableHead>
            <TableHead className="text-right">Действие</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow
              key={contract.id}
              className="cursor-pointer transition-colors duration-150"
              onClick={() => setSelectedId(contract.id)}
            >
              <TableCell className="font-medium">{contract.number}</TableCell>
              <TableCell>
                <div className="text-sm font-medium">{contract.clientName}</div>
                <div className="text-xs text-muted-foreground">{contract.projectName}</div>
              </TableCell>
              <TableCell className="tabular-nums">{formatTenge(contract.totalAmount)}</TableCell>
              <TableCell>
                <ProgressCell paid={contract.paidAmount} total={contract.totalAmount} />
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="gap-1.5">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: CONTRACT_STATUS_COLORS[contract.status] }}
                  />
                  {CONTRACT_STATUS_LABELS[contract.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="gap-1.5">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: AVR_STAGE_COLORS[contract.avrStage] }}
                  />
                  {AVR_STAGE_LABELS[contract.avrStage]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-sm font-medium text-primary">Открыть</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selected ? (
        <ContractDetailModal
          contract={selected}
          canManage={canManage}
          hasTemplate={hasTemplate}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}
