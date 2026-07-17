import { redirect } from "next/navigation";

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

// Финансовая операционка — видна только руководителю (сайдбар пункт
// тоже скрывает, это подстраховка на случай прямого перехода по ссылке).
export default async function ContractsPage() {
  const session = await auth();
  if (!session?.user || !canManageOperations(session.user)) {
    redirect("/");
  }

  const [contracts, projects, suggestedNumber] = await Promise.all([
    getContractsForCurrentUser(),
    getProjectsForContractSelect(),
    suggestContractNumber(),
  ]);

  return (
    <>
      <PageHeader
        title="Договоры"
        subtitle={formatTodayLabel(new Date())}
        action={<NewContractDialog projects={projects} suggestedNumber={suggestedNumber} />}
      />
      <div className="p-8">
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Договоров пока нет — добавьте первый.
          </p>
        ) : (
          <Card className="p-0">
            <ContractsTable contracts={contracts} canManage />
          </Card>
        )}
      </div>
    </>
  );
}
