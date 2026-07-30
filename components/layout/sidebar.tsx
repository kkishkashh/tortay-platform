"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UserCog,
  Handshake,
  FileText,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Building2,
  Bell,
  ListTodo,
  Calendar,
  ScrollText,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { AccountPortal } from "@/components/layout/account-portal";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { NotificationListItem } from "@/lib/notifications/queries";
import type { RoleTier } from "@/lib/departments/queries";
import type { EmployeeProfile } from "@/lib/employees/queries";
import type { PositionItem } from "@/lib/positions/queries";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  // "all" — виден всем; "admin_or_manager" — админу и руководителям
  // департаментов (напр. Департаменты — руководителю нужно попасть в свой
  // же департамент); "admin" — только администратору; "admin_or_finance" —
  // администратору и руководителю Административного департамента
  // (аутсорсеры/договоры, см. canManageFinance в lib/projects/permissions.ts).
  visibility?: "all" | "admin_or_manager" | "admin" | "admin_or_finance";
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Обзор",
    items: [
      { href: "/", label: "Дашборд", icon: LayoutDashboard },
      { href: "/my-tasks", label: "Мои задачи", icon: ListTodo },
      { href: "/calendar", label: "Календарь", icon: Calendar },
      { href: "/notifications", label: "Уведомления", icon: Bell },
    ],
  },
  {
    label: "Работа",
    items: [
      { href: "/projects", label: "Проекты", icon: FolderKanban },
      { href: "/departments", label: "Департаменты", icon: Building2 },
      { href: "/employees", label: "Сотрудники", icon: Users },
      { href: "/managers", label: "Руководители", icon: UserCog },
      { href: "/outsourcers", label: "Аутсорсеры", icon: Handshake, visibility: "admin_or_finance" },
    ],
  },
  {
    label: "Финансы",
    items: [{ href: "/contracts", label: "Договоры", icon: FileText, visibility: "admin_or_finance" }],
  },
  {
    label: "Администрирование",
    items: [{ href: "/audit-log", label: "Аудит-лог", icon: ScrollText, visibility: "admin" }],
  },
];

function isNavItemVisible(item: NavItem, roleTier: RoleTier, canManageFinance: boolean) {
  if (!item.visibility || item.visibility === "all") return true;
  if (item.visibility === "admin") return roleTier === "admin";
  if (item.visibility === "admin_or_finance") return roleTier === "admin" || canManageFinance;
  return roleTier === "admin" || roleTier === "department_manager";
}

const COLLAPSE_STORAGE_KEY = "tortay:sidebar-collapsed";

type SidebarProps = {
  fullName: string;
  systemRoleLabel: string;
  roleTier: RoleTier;
  canManageFinance: boolean;
  onSignOut: () => Promise<void>;
  notifications: NotificationListItem[];
  unreadNotificationCount: number;
  profile: EmployeeProfile | null;
  positions: PositionItem[];
  departments: { id: string; name: string }[];
};

export function Sidebar({
  fullName,
  systemRoleLabel,
  roleTier,
  canManageFinance,
  onSignOut,
  notifications,
  unreadNotificationCount,
  profile,
  positions,
  departments,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  }, []);

  // Закрываем мобильное меню при переходе на другую страницу — иначе
  // после клика по пункту меню drawer остаётся открытым поверх контента.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isNavItemVisible(item, roleTier, canManageFinance)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Открыть меню"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors duration-150 hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-sm font-semibold">Tortay Engineering</span>
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-0 lg:translate-x-0 lg:transition-[width]",
          mounted && collapsed ? "lg:w-[76px]" : "lg:w-64",
        )}
      >
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
        {!collapsed ? (
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">Tortay Engineering</span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              Co. — Управление командой
            </span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Закрыть меню"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent lg:hidden"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed ? (
              <span className="px-3 text-xs font-medium tracking-wide text-sidebar-foreground/40 uppercase">
                {group.label}
              </span>
            ) : null}
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_0_0_1px_rgba(232,160,48,0.25),0_0_16px_rgba(232,160,48,0.35)]"
                      : "text-sidebar-foreground/75 hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed ? item.label : null}
                  {isActive ? (
                    <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggleCollapsed}
        className="mx-3 mb-2 hidden items-center justify-center gap-2 rounded-lg py-2 text-xs text-sidebar-foreground/50 transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground lg:flex"
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        {!collapsed ? "Свернуть" : null}
      </button>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          {profile ? (
            <AccountPortal
              profile={profile}
              positions={positions}
              departments={departments}
              trigger={
                <button
                  type="button"
                  title="Мой аккаунт"
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-lg text-left transition-opacity duration-150 hover:opacity-80",
                    collapsed ? "shrink-0" : "flex-1",
                  )}
                >
                  <UserAvatar avatarUrl={profile.avatarUrl} fullName={fullName} seed={profile.id} />
                  {!collapsed ? (
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate text-sm font-medium">{fullName}</span>
                      <span className="truncate text-xs text-sidebar-foreground/60">
                        {systemRoleLabel}
                      </span>
                    </span>
                  ) : null}
                </button>
              }
            />
          ) : (
            <UserAvatar avatarUrl={null} fullName={fullName} seed={fullName} />
          )}
          {!collapsed ? (
            <>
              <NotificationBell notifications={notifications} unreadCount={unreadNotificationCount} />
              <ThemeToggle />
              <form action={onSignOut}>
                <button
                  type="submit"
                  title="Выйти"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
      </aside>
    </>
  );
}
