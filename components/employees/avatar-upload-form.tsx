"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { updateAvatarAction } from "@/lib/employees/actions";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function AvatarUploadForm({
  userId,
  fullName,
  avatarUrl,
}: {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // тот же файл можно будет выбрать повторно
    if (!file) return;

    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Поддерживаются только PNG, JPEG и WebP");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Файл больше 5 МБ");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    startTransition(async () => {
      try {
        const blob = await upload(`avatars/${userId}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/uploads/avatar",
        });
        await updateAvatarAction(userId, blob.url);
        setPreview(blob.url);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось загрузить файл",
        );
        setPreview(avatarUrl);
      } finally {
        URL.revokeObjectURL(localPreview);
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar avatarUrl={preview} fullName={fullName} seed={userId} size="lg" />
      <div className="space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          {isPending ? "Загружаем…" : "Загрузить фото"}
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPEG или WebP, до 5 МБ</p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
