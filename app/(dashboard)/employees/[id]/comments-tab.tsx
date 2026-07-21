import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { AssigneeCommentItem } from "@/lib/comments/queries";
import { getAvatarColor, getInitials } from "@/lib/utils";

function formatDateTime(date: Date) {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentsTab({ comments }: { comments: AssigneeCommentItem[] }) {
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">Комментариев по задачам этого сотрудника пока нет.</p>;
  }

  return (
    <div className="space-y-2">
      {comments.map((comment) => (
        <Card key={comment.id} size="sm">
          <CardContent className="flex items-start gap-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: getAvatarColor(comment.author.id) }}
            >
              {getInitials(comment.author.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{comment.author.fullName}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</p>
              </div>
              <p className="text-sm">{comment.text}</p>
              <Link
                href={`/projects/${comment.projectId}`}
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                {comment.projectName} · {comment.taskTitle}
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
