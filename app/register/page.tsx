import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { registerAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function submitAction(formData: FormData) {
  "use server";

  try {
    await registerAction(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось зарегистрироваться";
    redirect(`/register?error=${encodeURIComponent(message)}`);
  }

  // Отдельный try/catch: выше ловим только ошибки самой регистрации
  // (например, email уже занят) — signIn() при успехе сам бросает
  // служебный redirect-сигнал, который нельзя перехватывать как ошибку.
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sidebar px-4">
      <div
        className="pointer-events-none absolute -top-40 -left-40 size-[32rem] rounded-full bg-[color-mix(in_oklab,var(--sidebar-primary),transparent_78%)] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-[color-mix(in_oklab,var(--sidebar-primary),transparent_85%)] blur-3xl"
        aria-hidden
      />

      <form
        action={submitAction}
        className="relative w-full max-w-sm space-y-5 rounded-2xl bg-card p-8 text-card-foreground shadow-pop ring-1 ring-white/10"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <svg viewBox="0 0 28 28" fill="none" className="size-9" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 14 L14 4 L24 14 L14 24 Z" stroke="var(--primary)" strokeWidth="2" />
            <path
              d="M14 4 L14 24 M4 14 L24 14"
              stroke="var(--primary)"
              strokeWidth="1.5"
              opacity="0.4"
            />
            <circle cx="14" cy="14" r="3" fill="var(--primary)" />
          </svg>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Регистрация</h1>
            <p className="text-sm text-muted-foreground">Tortay Engineering</p>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="fullName">ФИО</Label>
          <Input id="fullName" name="fullName" required autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input id="password" name="password" type="password" minLength={6} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Повторите пароль</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            minLength={6}
            required
          />
        </div>

        <Button type="submit" className="w-full">
          Зарегистрироваться
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Войти
          </Link>
        </p>
      </form>
    </main>
  );
}
