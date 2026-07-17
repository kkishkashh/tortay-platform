"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/lib/employees/actions";

// Сам сотрудник подтверждает текущий пароль; руководитель, сбрасывающий
// пароль другого сотрудника, — нет (см. changePasswordAction).
export function PasswordForm({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await changePasswordAction(formData);
        setShowToast(true);
        formRef.current?.reset();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить");
      }
    });
  }

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 3000);
    return () => clearTimeout(timer);
  }, [showToast]);

  return (
    <>
      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        {isSelf ? (
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Текущий пароль</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Новый пароль</Label>
          <Input id="newPassword" name="newPassword" type="password" minLength={6} required />
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Сохраняем…" : isSelf ? "Сменить пароль" : "Сбросить пароль"}
        </Button>
      </form>

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <CheckCircle2 className="size-4" />
          Пароль обновлён
        </div>
      ) : null}
    </>
  );
}
