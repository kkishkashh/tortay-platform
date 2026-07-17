import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
