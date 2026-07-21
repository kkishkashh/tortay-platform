"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createTaskAttachmentAction, deleteTaskAttachmentAction } from "@/lib/documents/actions";
import type { TaskAttachmentItem } from "@/lib/documents/queries";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

function formatFileSize(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function TaskAttachments({
  taskId,
  attachments,
  currentUserId,
  canModerate,
}: {
  taskId: string;
  attachments: TaskAttachmentItem[];
  currentUserId: string | undefined;
  canModerate: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    if (file.size > MAX_SIZE_BYTES) {
      setError("Файл больше 20 МБ");
      return;
    }

    startTransition(async () => {
      try {
        const blob = await upload(`tasks/${taskId}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/uploads/task-attachment",
        });
        await createTaskAttachmentAction(taskId, {
          fileName: file.name,
          fileUrl: blob.url,
          fileSize: file.size,
        });
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось загрузить файл",
        );
      }
    });
  }

  function handleDelete(documentId: string) {
    startTransition(async () => {
      await deleteTaskAttachmentAction(documentId);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Файлы
        </p>
        <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          {isPending ? "Загружаем…" : "Добавить"}
        </Button>
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Файлов пока нет.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5"
            >
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm hover:underline"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(doc.fileSize)}
                </span>
              </a>
              {canModerate || doc.uploader.id === currentUserId ? (
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  disabled={isPending}
                  aria-label="Удалить файл"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export { Paperclip };
