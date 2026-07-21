import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { auth } from "@/auth";

// onUploadCompleted (webhook) сознательно не используется — ему нужен
// публично доступный callback-URL, которого нет у локального `next dev`
// (см. решение D10 в плане). Вместо этого клиент после успешного upload()
// сам вызывает updateAvatarAction с готовым URL — работает одинаково и в
// dev, и в проде.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const session = await auth();
        if (!session?.user) {
          throw new Error("Не авторизован");
        }

        // Клиент сам формирует путь как `avatars/<userId>/...` — здесь
        // только проверяем, что он не подделан на чужой userId, а не
        // задаём путь заново (handleUpload не даёт переопределить pathname).
        if (!pathname.startsWith(`avatars/${session.user.id}/`)) {
          throw new Error("Некорректный путь загрузки");
        }

        return {
          allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024,
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
