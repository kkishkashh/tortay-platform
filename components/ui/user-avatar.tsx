import { getAvatarColor, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "size-6 text-[10px]",
  default: "size-9 text-xs",
  lg: "size-16 text-lg",
} as const;

// Общий рендер аватара — фото, если оно есть (Vercel Blob), иначе тот же
// круг с инициалами, что был единственным вариантом до этой фазы. Ни один
// существующий вызов не ломается: avatarUrl просто ещё не заполнен.
export function UserAvatar({
  avatarUrl,
  fullName,
  seed,
  size = "default",
  className,
}: {
  avatarUrl: string | null | undefined;
  fullName: string;
  // Цвет плейсхолдера стабильно вычисляется по этому seed (обычно id
  // пользователя) — тот же getAvatarColor, что и раньше.
  seed: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- внешний Blob URL, не оптимизируем через next/image
      <img
        src={avatarUrl}
        alt={fullName}
        className={cn("shrink-0 rounded-full object-cover", SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: getAvatarColor(seed) }}
    >
      {getInitials(fullName)}
    </span>
  );
}
