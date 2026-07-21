"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEmployeeContactAction } from "@/lib/employees/actions";

export function ContactForm({
  userId,
  email,
  phone,
}: {
  userId: string;
  email: string;
  phone: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateEmployeeContactAction(formData);
        setShowToast(true);
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
      <form action={handleSubmit} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" defaultValue={email} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone">Телефон</Label>
          <Input id="contact-phone" name="phone" type="tel" defaultValue={phone ?? ""} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Сохраняем…" : "Сохранить"}
        </Button>
      </form>

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg">
          <CheckCircle2 className="size-4" />
          Контактные данные обновлены
        </div>
      ) : null}
    </>
  );
}
