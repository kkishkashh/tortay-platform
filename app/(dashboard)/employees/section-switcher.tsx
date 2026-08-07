"use client";

import { useState } from "react";
import { UserCog, Users } from "lucide-react";

import { ManagersTab } from "@/components/employees/managers-tab";
import type { DepartmentListItem, ManagerCandidate } from "@/lib/departments/queries";
import type { EmployeeListItem } from "@/lib/employees/queries";
import type { ChiefTechnicalDirectorItem, ManagerListItem } from "@/lib/managers/queries";
import type { PositionItem } from "@/lib/positions/queries";
import { cn } from "@/lib/utils";

import { EmployeesExplorer } from "./employees-explorer";
import { NewEmployeeDialog } from "./new-employee-dialog";

type View = "employees" | "managers" | null;

// Обычные кнопки + useState, а не Tabs (2026-08-07) — Tabs всегда держит
// какую-то вкладку активной, а тут нужно состояние "ничего не выбрано" при
// заходе на страницу (см. обсуждение бага: TabsList/TabsTrigger несут
// встроенную высоту под мелкие пилюли-вкладки, которая ломала крупные
// плитки-карточки). Вид карточек — как у StatCard на Дашборде.
export function EmployeesManagersSwitcher({
  initialView,
  employees,
  canAddEmployees,
  isAdmin,
  positions,
  chiefTechnicalDirectors,
  managers,
  departments,
  employeeCandidates,
  isManagersAdmin,
  managerPositions,
  gipPickerProjects,
}: {
  initialView: View;
  employees: EmployeeListItem[];
  canAddEmployees: boolean;
  isAdmin: boolean;
  positions: PositionItem[];
  chiefTechnicalDirectors: ChiefTechnicalDirectorItem[];
  managers: ManagerListItem[];
  departments: DepartmentListItem[];
  employeeCandidates: ManagerCandidate[];
  isManagersAdmin: boolean;
  managerPositions: PositionItem[];
  gipPickerProjects: { id: string; name: string }[];
}) {
  const [view, setView] = useState<View>(initialView);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SwitchTile
          label="Сотрудники"
          value={employees.length}
          icon={Users}
          gradient="from-[#16a34a] to-[#0d7a37]"
          active={view === "employees"}
          onClick={() => setView("employees")}
        />
        <SwitchTile
          label="Руководители"
          value={managers.length}
          icon={UserCog}
          gradient="from-[#f0ac3d] to-[#c47a12]"
          active={view === "managers"}
          onClick={() => setView("managers")}
        />
      </div>

      {view === "employees" ? (
        <div>
          {canAddEmployees ? (
            <div className="mb-4 flex justify-end">
              <NewEmployeeDialog isAdmin={isAdmin} positions={positions} />
            </div>
          ) : null}
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сотрудников пока нет.</p>
          ) : (
            <EmployeesExplorer employees={employees} />
          )}
        </div>
      ) : null}

      {view === "managers" ? (
        <ManagersTab
          chiefTechnicalDirectors={chiefTechnicalDirectors}
          managers={managers}
          departments={departments}
          employeeCandidates={employeeCandidates}
          isAdmin={isManagersAdmin}
          positions={managerPositions}
          gipPickerProjects={gipPickerProjects}
        />
      ) : null}
    </div>
  );
}

function SwitchTile({
  label,
  value,
  icon: Icon,
  gradient,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  gradient: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl bg-linear-to-br p-5 text-left text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        gradient,
        active
          ? "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background"
          : "opacity-80 hover:opacity-100",
      )}
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110"
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white/80">{label}</span>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
          <Icon className="size-4.5" />
        </div>
      </div>
      <p className="relative mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </button>
  );
}
