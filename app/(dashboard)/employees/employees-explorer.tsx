"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { EmployeeListItem } from "@/lib/employees/queries";
import { getInitials } from "@/lib/utils";

import { EmployeeCard } from "./employee-card";

export function EmployeesExplorer({ employees }: { employees: EmployeeListItem[] }) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = useMemo(() => employees.filter((e) => !e.isActive).length, [employees]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (!showArchived && !employee.isActive) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        employee.fullName,
        employee.position ?? "",
        getInitials(employee.fullName),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [employees, query, showArchived]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск сотрудника..."
            className="h-10 pl-9"
          />
        </div>
        {archivedCount > 0 ? (
          <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={showArchived} onCheckedChange={(checked) => setShowArchived(checked === true)} />
            Показать архив ({archivedCount})
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ничего не найдено.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} />
          ))}
        </div>
      )}
    </div>
  );
}
