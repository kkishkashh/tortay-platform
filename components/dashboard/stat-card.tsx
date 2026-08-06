import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const GRADIENTS = {
  blue: "from-[#2563eb] to-[#1741a6]",
  green: "from-[#16a34a] to-[#0d7a37]",
  gold: "from-[#f0ac3d] to-[#c47a12]",
  purple: "from-[#7c3aed] to-[#5423ab]",
} as const;

export type StatCardColor = keyof typeof GRADIENTS;

// href необязателен — карточки без него остаются как раньше, просто
// плиткой статистики (напр. проценты загрузки, которые никуда не ведут).
export function StatCard({
  label,
  value,
  icon: Icon,
  color = "gold",
  href,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  color?: StatCardColor;
  href?: string;
}) {
  const content = (
    <>
      <div
        className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110"
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white/80">{label}</span>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
          <Icon className="size-4.5" />
        </div>
      </div>
      <p className="relative mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </>
  );

  const className = cn(
    "group relative overflow-hidden rounded-xl bg-linear-to-br p-5 text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
    GRADIENTS[color],
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
