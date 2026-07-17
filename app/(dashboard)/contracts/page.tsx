import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  getContractsForCurrentUser,
  getProjectsForContractSelect,
  suggestContractNumber,
} from "@/lib/contracts/queries";
import { canManageOperations } from "@/lib/projects/permissions";
import { formatTodayLabel } from "@/lib/utils";

import { ContractsTable } from "./contracts-table";
import { NewContractDialog } from "./new-contract-dialog";

export default async function ContractsPage() {
  const [session, contracts, projects, suggestedNumber] = await Promise.all([
    auth(),
    getContractsForCurrentUser(),
    getProjectsForContractSelect(),
    suggestContractNumber(),
  ]);

  const canManage = session?.user ? canManageOperations(session.user) : false;

  return (
    <>
      <PageHeader
        title="Договоры"
        subtitle={formatTodayLabel(new Date())}
        action={
          canManage ? (
            <NewContractDialog projects={projects} suggestedNumber={suggestedNumber} />
          ) : undefined
        }
      />
      <div className="p-8">
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Договоров пока нет — добавьте первый.
          </p>
        ) : (
          <Card className="p-0">
            <ContractsTable contracts={contracts} canManage={canManage} />
          </Card>
        )}
      </div>
    </>
  );
}
