import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { auth } from "@/auth";
import { canManageContractTemplate } from "@/lib/contract-templates/permissions";

// Тот же принцип, что и у app/api/uploads/avatar/route.ts (см. D10 в
// плане): без onUploadCompleted-вебхука, клиент сам вызывает
// setActiveContractTemplateAction после успешного upload(). Только .docx —
// docxtemplater/pizzip (см. lib/contracts/contract-docx-template.ts)
// умеют разбирать только реальный Word-контейнер, а не .doc/.pdf.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();
        if (!session?.user || !canManageContractTemplate(session.user)) {
          throw new Error("Недостаточно прав для загрузки шаблона договора");
        }

        return {
          allowedContentTypes: [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить файл" },
      { status: 400 },
    );
  }
}
