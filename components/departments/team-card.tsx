"use client";

import { Users } from "lucide-react";

// Тот же язык, что у StatCard на дашборде (components/dashboard/stat-card.tsx) —
// полный цветной градиент, а не белая карточка с тонкой полосой (так раньше
// рисовались блоки руководителей на вкладке "Структура"). Без оранжевого —
// у каждого руководителя свой цвет, чтобы визуально не путать команды.
const TEAM_CARD_GRADIENTS = {
  blue: "from-[#2563eb] to-[#1741a6]",
  green: "from-[#16a34a] to-[#0d7a37]",
  coral: "from-[#ef4444] to-[#b91c1c]",
  purple: "from-[#7c3aed] to-[#5423ab]",
} as const;

export type TeamCardColor = keyof typeof TEAM_CARD_GRADIENTS;

const TEAM_CARD_COLOR_KEYS = Object.keys(TEAM_CARD_GRADIENTS) as TeamCardColor[];

// Цвет закреплён за managerId хэшем (тот же приём, что и в
// lib/utils.ts::getAvatarColor), а НЕ порядковым индексом в списке — иначе
// при пересортировке руководителей их цвета "прыгали" бы между карточками.
export function getTeamCardColor(seed: string): TeamCardColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TEAM_CARD_COLOR_KEYS[Math.abs(hash) % TEAM_CARD_COLOR_KEYS.length];
}

export function TeamCard({
  manager,
  leads,
  employeeCount,
  color = "blue",
  onClick,
}: {
  manager: { id: string; fullName: string };
  // Имена ВСЕХ Лидов этого руководителя — их может быть 0, 1 или несколько
  // (см. lib/leads/queries.ts::DepartmentHierarchyManager.leads).
  leads: string[];
  employeeCount: number;
  color?: TeamCardColor;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-xl bg-linear-to-br p-5 text-left text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover ${TEAM_CARD_GRADIENTS[color]}`}
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white/80">Руководитель</span>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
          <Users className="size-4.5" />
        </div>
      </div>

      <p className="relative mt-3 truncate text-xl font-semibold tracking-tight">
        {manager.fullName}
      </p>

      <div className="relative mt-3 space-y-1 text-sm text-white/85">
        {leads.length === 0 ? (
          <p>Лид не назначен</p>
        ) : (
          <p className="truncate">
            {leads.length > 1 ? "Лиды: " : "Лид: "}
            {leads.join(", ")}
          </p>
        )}
        <p>
          Сотрудников в команде: <span className="font-semibold">{employeeCount}</span>
        </p>
      </div>
    </button>
  );
}
