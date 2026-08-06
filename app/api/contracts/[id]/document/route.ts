import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { fillContractTemplate } from "@/lib/contracts/contract-docx-template";
import { canManageFinance } from "@/lib/projects/permissions";

// Та же зона видимости, что и у остальной страницы "Договоры"
// (canManageFinance) — не canManageContractTemplate, скачивание договора
// не то же самое, что смена общего шаблона (см. lib/contract-templates/
// permissions.ts).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { buffer, fileName } = await fillContractTemplate(id);

    // Кириллица в имени файла требует RFC 5987 (filename*=UTF-8''...) — тот
    // же приём, что и у app/api/outsourcers/[id]/contract/route.ts.
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="contract.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сформировать договор" },
      { status: 400 },
    );
  }
}
