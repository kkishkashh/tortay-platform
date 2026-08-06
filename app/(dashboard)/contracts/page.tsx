import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { canManageContractTemplate } from "@/lib/contract-templates/permissions";
import { getActiveContractTemplate } from "@/lib/contract-templates/queries";
import {
  getContractsForCurrentUser,
  getProjectsForContractSelect,
  suggestContractNumber,
} from "@/lib/contracts/queries";
import { canManageFinance } from "@/lib/projects/permissions";
import { formatTodayLabel } from "@/lib/utils";

import { ChangeTemplateDialog } from "./change-template-dialog";
import { ContractsTable } from "./contracts-table";
import { NewContractDialog } from "./new-contract-dialog";

// Финансово-кадровая зона — видна руководителю компании и руководителю
// Административного департамента (см. lib/projects/permissions.ts,
// canManageFinance). Сайдбар пункт тоже скрывает для остальных, это
// подстраховка на случай прямого перехода по ссылке.
export default async function ContractsPage() {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    redirect("/");
  }

  const [contracts, projects, suggestedNumber, activeTemplate] = await Promise.all([
    getContractsForCurrentUser(),
    getProjectsForContractSelect(),
    suggestContractNumber(),
    getActiveContractTemplate(),
  ]);
  const canChangeTemplate = canManageContractTemplate(session.user);

  return (
    <>
      <PageHeader
        title="Договоры"
        subtitle={formatTodayLabel(new Date())}
        action={
          <div className="flex items-center gap-2">
            {canChangeTemplate ? <ChangeTemplateDialog currentTemplate={activeTemplate} /> : null}
            <NewContractDialog projects={projects} suggestedNumber={suggestedNumber} />
          </div>
        }
      />
      <div className="p-8">
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Договоров пока нет — добавьте первый.
          </p>
        ) : (
          <Card className="p-0">
            <ContractsTable contracts={contracts} canManage hasTemplate={activeTemplate !== null} />
          </Card>
        )}
      </div>
    </>
  );
}
