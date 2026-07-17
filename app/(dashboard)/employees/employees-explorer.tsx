"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { EmployeeListItem } from "@/lib/employees/queries";
import { getInitials } from "@/lib/utils";

import { EmployeeCard } from "./employee-card";

export function EmployeesExplorer({ employees }: { employees: EmployeeListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return employees;
    return employees.filter((employee) => {
      const haystack = [
        employee.fullName,
        employee.position ?? "",
        getInitials(employee.fullName),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [employees, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск сотрудника..."
          className="h-10 pl-9"
        />
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
