import { SystemRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isFullAdmin } from "@/lib/auth/roles";
import { isLeadOfDepartment } from "@/lib/leads/queries";

// Операционная часть (создание проектов, смена статусов проектов/разделов,
// назначение ГИП, удаление) — у администратора компании безусловно, и у
// руководителя департамента, но ТОЛЬКО в рамках "его": либо он руководит
// ЛЮБЫМ департаментом (для самого факта создания проекта — на этапе
// создания проекта ещё не существует, ограничивать нечем), либо (для
// действий над уже существующим проектом/разделом) этот проект/раздел
// реально относится к его департаменту (см. userManagesDepartmentInProject
// ниже). Раньше был широкий грант "любой руководитель департамента = права
// на ВСЕ проекты компании", но по прямой просьбе Камилы сузили обратно до
// "только то, что касается его департамента" — второй параметр здесь
// всегда должен быть вычислен ПОД КОНКРЕТНОЕ действие вызывающим кодом, а
// не браться из общего "руководит хоть чем-то".
//
// financeAccess (бухгалтеры) — по прямой просьбе Камилы 2026-07-29 тоже
// получает полный доступ ко ВСЕМ проектам компании (создание/редактирование/
// удаление/назначение ГИП), а не только к привязке аутсорсеров, как было
// изначально решено при добавлении этой роли часом ранее — она явно
// расширила решение до "пусть могут создавать и редактировать и удалять
// всё". financeAccess живёт в session.user (см. auth.ts/types/next-auth.d.ts),
// поэтому здесь синхронная проверка, без похода в базу.
//
// isProjectLead (2026-08-05, расширено 2026-08-06 по прямой просьбе): ГИП
// ИЛИ МЕНЕДЖЕР хотя бы одного проекта получает те же операционные
// права, что и системная роль РУКОВОДИТЕЛЬ, по ВСЕЙ компании (не только в
// своём проекте) — тоже живёт в session.user, вычисляется один раз при
// входе (см. auth.ts).
//
// allProjectsAccess (2026-08-06, по прямой просьбе — для руководителя
// Архитектуры) — тот же принцип, что и financeAccess: отдельный точечный
// флаг на User, НЕ привязанный к конкретной роли/департаменту в коде.
// Специально НЕ учитывается в getCurrentUserRoleTier (см. lib/departments/
// queries.ts) — даёт операционные права и видимость всех проектов, но не
// company-wide дашборд/аудит-лог/финансы.
export function canManageOperations(
  user: {
    systemRole: SystemRole;
    financeAccess?: boolean;
    isProjectLead?: boolean;
    allProjectsAccess?: boolean;
  },
  managesRelevantScope = false,
) {
  return (
    isFullAdmin(user.systemRole) ||
    user.systemRole === SystemRole.РУКОВОДИТЕЛЬ ||
    !!user.financeAccess ||
    !!user.isProjectLead ||
    !!user.allProjectsAccess ||
    managesRelevantScope
  );
}

// Только для CREATE — на этапе создания проекта ограничивать ещё нечем
// (сам проект ещё не существует), поэтому единственный содержательный
// вопрос — руководит ли пользователь хоть каким-то департаментом вообще.
export async function userManagesAnyDepartment(user: { id: string }): Promise<boolean> {
  const managed = await prisma.department.findFirst({
    where: { managers: { some: { id: user.id } } },
    select: { id: true },
  });
  return !!managed;
}

// Для действий над УЖЕ существующим проектом (переименование, смена
// статуса, назначение ГИП, удаление) — "относится к его департаменту"
// означает: хотя бы один раздел (Section) этого проекта принадлежит
// департаменту, которым руководит пользователь. Раздельно от
// userManagesAnyDepartment: там просто "руководит хоть чем-то", здесь —
// именно ЭТИМ проектом через хотя бы один свой раздел.
export async function userManagesDepartmentInProject(
  user: { id: string },
  projectId: string,
): Promise<boolean> {
  const section = await prisma.section.findFirst({
    where: { projectId, department: { managers: { some: { id: user.id } } } },
    select: { id: true },
  });
  return !!section;
}

// Право на "Добавить участника" на странице проекта (2026-08-06, по
// прямой просьбе) — canManageOperations(user, managesThisProject) уже
// покрывает админа/ГТД/РУКОВОДИТЕЛЯ/финансы/ГИП-МЕНЕДЖЕР где угодно
// в компании/руководителя профильного департамента ЭТОГО проекта. Плюс
// узкий, отдельный кейс: Лид департамента, у которого есть раздел в этом
// проекте — та же логика, что уже используется для продления сроков
// разделов (см. updateSectionDatesAction), но на уровне всего проекта, а
// не одного раздела: перебираем департаменты всех разделов проекта.
export async function userIsLeadInProject(
  user: { id: string },
  projectId: string,
): Promise<boolean> {
  const sections = await prisma.section.findMany({
    where: { projectId, departmentId: { not: null } },
    select: { departmentId: true },
    distinct: ["departmentId"],
  });
  for (const section of sections) {
    if (section.departmentId && (await isLeadOfDepartment(user.id, section.departmentId))) {
      return true;
    }
  }
  return false;
}

// Финансово-кадровая зона (аутсорсеры, договоры) — открыта руководителю
// Административного департамента (код "ADM": "подбор персонала; оформление
// новых работников; заключение договоров; ведение учета расходов/доходов" —
// реальные обязанности этого департамента) и отдельным сотрудникам с
// точечным флагом User.financeAccess (см. схему), без того, чтобы делать их
// руководителями департамента.
//
// История (по прямой просьбе Камилы, 2026-08-04): до этой даты — в отличие
// от canManageOperations — здесь НЕ БЫЛО автоматического гранта по
// systemRole === РУКОВОДИТЕЛЬ (тогда единственной "полной" роли) — любой
// администратор компании видел финансы безусловно, что и хотели убрать.
//
// 2026-08-05: с введением роли АДМИН (см. schema.prisma — новая, более
// полная роль, отдельная от РУКОВОДИТЕЛЬ) это решение осознанно развёрнуто
// ОБРАТНО, но только для АДМИН: "админ имеет доступ ко всему-всему" (прямая
// формулировка пользователя). РУКОВОДИТЕЛЬ по-прежнему НЕ получает финансы
// автоматически — только через financeAccess/руководство ADM, как и раньше.
export async function canManageFinance(
  user: { id: string; systemRole?: SystemRole; financeAccess?: boolean },
): Promise<boolean> {
  if (user.systemRole && isFullAdmin(user.systemRole)) return true;
  if (user.financeAccess) return true;
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { financeAccess: true, managedDepartments: { where: { code: "ADM" }, select: { id: true } } },
  });
  return !!record?.financeAccess || !!record?.managedDepartments.length;
}
