import Link from "next/link";

import { cn } from "@/lib/utils";

// Стандартный переключатель Sign In / Sign Up — по-русски "Вход" /
// "Регистрация". Обычные ссылки, а не клиентский Tabs-компонент: /login и
// /register — разные страницы с разными server actions, а не вкладки
// одной формы.
export function AuthTabs({ active }: { active: "login" | "register" }) {
  const tabClass = (tab: "login" | "register") =>
    cn(
      "rounded-md py-1.5 text-center text-sm font-medium transition-colors",
      active === tab
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      <Link href="/login" className={tabClass("login")}>
        Вход
      </Link>
      <Link href="/register" className={tabClass("register")}>
        Регистрация
      </Link>
    </div>
  );
}
