"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Handshake,
  FileText,
  LogOut,
} from "lucide-react";

import { cn, getInitials } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  // Аутсорсеры и договоры — операционка, видна только руководителю
  // (см. lib/projects/permissions.ts), сотруднику пункт вообще не
  // показываем, а не просто блокируем действия внутри.
  headOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Обзор",
    items: [{ href: "/", label: "Дашборд", icon: LayoutDashboard }],
  },
  {
    label: "Работа",
    items: [
      { href: "/projects", label: "Проекты", icon: FolderKanban },
      { href: "/employees", label: "Сотрудники", icon: Users },
      { href: "/outsourcers", label: "Аутсорсеры", icon: Handshake, headOnly: true },
    ],
  },
  {
    label: "Финансы",
    items: [{ href: "/contracts", label: "Договоры", icon: FileText, headOnly: true }],
  },
];

type SidebarProps = {
  fullName: string;
  systemRoleLabel: string;
  isHead: boolean;
  onSignOut: () => Promise<void>;
};

export function Sidebar({ fullName, systemRoleLabel, isHead, onSignOut }: SidebarProps) {
  const pathname = usePathname();

  const initials = getInitials(fullName);

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.headOnly || isHead),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-6 py-6">
        <svg
          viewBox="0 0 28 28"
          fill="none"
          className="size-7 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 14 L14 4 L24 14 L14 24 Z"
            stroke="var(--sidebar-primary)"
            strokeWidth="2"
          />
          <path
            d="M14 4 L14 24 M4 14 L24 14"
            stroke="var(--sidebar-primary)"
            strokeWidth="1.5"
            opacity="0.4"
          />
          <circle cx="14" cy="14" r="3" fill="var(--sidebar-primary)" />
        </svg>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Tortay Engineering</span>
          <span className="text-xs text-sidebar-foreground/60">
            Co. — Управление командой
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="px-3 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/40">
              {group.label}
            </span>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{fullName}</span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {systemRoleLabel}
            </span>
          </div>
          <form action={onSignOut}>
            <button
              type="submit"
              title="Выйти"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
