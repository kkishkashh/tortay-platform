import { SystemRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
export function canManageOperations(
  user: { systemRole: SystemRole },
  managesRelevantScope = false,
) {
  return user.systemRole === SystemRole.РУКОВОДИТЕЛЬ || managesRelevantScope;
}

// Только для CREATE — на этапе создания проекта ограничивать ещё нечем
// (сам проект ещё не существует), поэтому единственный содержательный
// вопрос — руководит ли пользователь хоть каким-то департаментом вообще.
export async function userManagesAnyDepartment(user: { id: string }): Promise<boolean> {
  const managed = await prisma.department.findFirst({
    where: { managerId: user.id },
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
    where: { projectId, department: { managerId: user.id } },
    select: { id: true },
  });
  return !!section;
}

// Финансово-кадровая зона (аутсорсеры, договоры) — по
// прямой просьбе пользователя открыта ЕЩЁ и руководителю Административного
// департамента (код "ADM": "подбор персонала; оформление новых работников;
// заключение договоров; ведение учета расходов/доходов" — реальные
// обязанности этого департамента), помимо администратора компании.
// Отдельная, более узкая зона, чем canManageOperations — НЕ открыта всем
// руководителям департаментов, только ADM (плюс, разумеется, тем, кто уже
// проходит canManageOperations как администратор).
export async function canManageFinance(user: { id: string; systemRole: SystemRole }): Promise<boolean> {
  if (canManageOperations(user)) return true;
  const managed = await prisma.department.findFirst({
    where: { managerId: user.id, code: "ADM" },
    select: { id: true },
  });
  return !!managed;
}
