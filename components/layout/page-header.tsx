import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  action?: ReactNode;
};

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b px-8 py-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      {action}
    </div>
  );
}
