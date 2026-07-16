import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <>
      <PageHeader title="Дашборд" />
      <div className="p-8">
        <p className="text-sm text-muted-foreground">
          Здравствуйте, {session?.user.name}! Здесь будет сводка по всем
          проектам — это следующая фича по методологии.
        </p>
      </div>
    </>
  );
}
