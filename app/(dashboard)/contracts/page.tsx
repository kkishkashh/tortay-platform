import { PageHeader } from "@/components/layout/page-header";

export default function ContractsPage() {
  return (
    <>
      <PageHeader title="Договоры" />
      <div className="p-8">
        <p className="text-sm text-muted-foreground">
          Здесь появится финансовый блок: договоры, реквизиты, транши и АВР.
        </p>
      </div>
    </>
  );
}
