import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { requestVerificationCodeAction, verifyCodeAndSetPasswordAction } from "@/lib/auth/actions";
import { AuthTabs } from "@/components/auth/auth-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

async function requestCodeSubmit(formData: FormData) {
  "use server";

  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  try {
    await requestVerificationCodeAction(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить код";
    redirect(`/register?error=${encodeURIComponent(message)}`);
  }
  redirect(`/register?step=code&email=${encodeURIComponent(email)}`);
}

async function verifyCodeSubmit(formData: FormData) {
  "use server";

  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  try {
    await verifyCodeAndSetPasswordAction(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось завершить регистрацию";
    redirect(`/register?step=code&email=${encodeURIComponent(email)}&error=${encodeURIComponent(message)}`);
  }

  // Отдельный try/catch: выше ловим только ошибки самой проверки кода —
  // signIn() при успехе сам бросает служебный redirect-сигнал, который
  // нельзя перехватывать как ошибку (см. app/login/page.tsx).
  try {
    await signIn("credentials", {
      email,
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

function AuthShellHeader({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <svg viewBox="0 0 28 28" fill="none" className="size-9" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 14 L14 4 L24 14 L14 24 Z" stroke="var(--primary)" strokeWidth="2" />
        <path d="M14 4 L14 24 M4 14 L24 14" stroke="var(--primary)" strokeWidth="1.5" opacity="0.4" />
        <circle cx="14" cy="14" r="3" fill="var(--primary)" />
      </svg>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">Tortay Engineering</p>
      </div>
    </div>
  );
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string; email?: string }>;
}) {
  const { error, step, email } = await searchParams;
  const isCodeStep = step === "code" && !!email;

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

      {isCodeStep ? (
        <form
          action={verifyCodeSubmit}
          className="relative w-full max-w-sm space-y-5 rounded-2xl bg-card p-8 text-card-foreground shadow-pop ring-1 ring-white/10"
        >
          <AuthShellHeader title="Введите код из письма" />
          <AuthTabs active="register" />

          <input type="hidden" name="email" value={email} />

          <p className="text-center text-sm text-muted-foreground">
            Мы отправили код на <span className="font-medium text-foreground">{email}</span>
          </p>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="code">Код из письма</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              className="text-center text-lg tracking-[0.5em]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Придумайте пароль</Label>
            <PasswordInput id="password" name="password" minLength={6} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Повторите пароль</Label>
            <PasswordInput id="confirmPassword" name="confirmPassword" minLength={6} required />
          </div>

          <Button type="submit" className="w-full">
            Подтвердить и войти
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Неверный email?{" "}
            <a href="/register" className="font-medium text-primary hover:underline">
              Начать заново
            </a>
          </p>
        </form>
      ) : (
        <form
          action={requestCodeSubmit}
          className="relative w-full max-w-sm space-y-5 rounded-2xl bg-card p-8 text-card-foreground shadow-pop ring-1 ring-white/10"
        >
          <AuthShellHeader title="Регистрация" />
          <AuthTabs active="register" />

          <p className="text-center text-sm text-muted-foreground">
            Введите вашу корпоративную почту — мы пришлём код для подтверждения
          </p>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus placeholder="имя@tortay.kz" />
          </div>

          <Button type="submit" className="w-full">
            Отправить код
          </Button>
        </form>
      )}
    </main>
  );
}
