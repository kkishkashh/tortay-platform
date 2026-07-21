"use client";

import { useRef, useState, useTransition } from "react";
import { MessageSquare, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createTaskCommentAction, deleteTaskCommentAction } from "@/lib/comments/actions";
import type { TaskCommentItem } from "@/lib/comments/queries";
import { getAvatarColor, getInitials } from "@/lib/utils";

function formatDateTime(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskCommentsDialog({
  taskId,
  comments,
  currentUserId,
  canModerate,
}: {
  taskId: string;
  comments: TaskCommentItem[];
  currentUserId: string | undefined;
  canModerate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createTaskCommentAction(taskId, formData);
        formRef.current?.reset();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось добавить комментарий",
        );
      }
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      await deleteTaskCommentAction(commentId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="xs" title="Комментарии" />
        }
      >
        <MessageSquare className="size-3.5" />
        {comments.length > 0 ? comments.length : ""}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Комментарии</DialogTitle>
        </DialogHeader>

        <div className="max-h-80 space-y-3 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет комментариев.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2.5">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: getAvatarColor(comment.author.id) }}
                >
                  {getInitials(comment.author.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{comment.author.fullName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {formatDateTime(comment.createdAt)}
                      {canModerate || comment.author.id === currentUserId ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(comment.id)}
                          disabled={isPending}
                          aria-label="Удалить комментарий"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm">{comment.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form ref={formRef} action={handleSubmit} className="space-y-2">
          <Textarea name="text" placeholder="Написать комментарий…" rows={2} required />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Отправляем…" : "Отправить"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
