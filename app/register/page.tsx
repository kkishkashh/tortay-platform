import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { registerAction } from "@/lib/auth/actions";

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
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        action={submitAction}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <h1 className="text-center text-xl font-semibold">Регистрация</h1>

        {error && (
          <p className="text-center text-sm text-red-600">{error}</p>
        )}

        <div className="space-y-1">
          <label htmlFor="fullName" className="text-sm font-medium">
            ФИО
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={6}
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Повторите пароль
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            minLength={6}
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-black py-2 text-sm font-medium text-white"
        >
          Зарегистрироваться
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="underline">
            Войти
          </Link>
        </p>
      </form>
    </main>
  );
}
