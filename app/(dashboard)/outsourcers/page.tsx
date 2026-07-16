import { PageHeader } from "@/components/layout/page-header";

export default function OutsourcersPage() {
  return (
    <>
      <PageHeader title="Аутсорсеры" />
      <div className="p-8">
        <p className="text-sm text-muted-foreground">
          Здесь появится список внештатных участников проектов (userType =
          АУТСОРСЕР) — это информационный фильтр, не отдельные права доступа.
        </p>
      </div>
    </>
  );
}
