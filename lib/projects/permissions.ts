import { SystemRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Вся операционная часть (смена статусов проектов/разделов, платежи,
// договоры, создание новых проектов) — зона ответственности только
// РУКОВОДИТЕЛЯ. Раньше это мог делать ещё и ГИП конкретного проекта —
// осознанно сузили: сотрудник (даже будучи ГИП) операционку не трогает,
// только смотрит.
export function canManageOperations(user: { systemRole: SystemRole }) {
  return user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
}

// Финансово-кадровая зона (аутсорсеры, договоры, оклад сотрудников) — по
// прямой просьбе пользователя открыта ЕЩЁ и руководителю Административного
// департамента (код "ADM": "подбор персонала; оформление новых работников;
// заключение договоров; ведение учета расходов/доходов" — реальные
// обязанности этого департамента), помимо администратора компании.
// Отдельная, более узкая зона, чем canManageOperations — проектная
// операционка (статусы/платежи ПО ПРОЕКТАМ, создание проектов) остаётся
// только у РУКОВОДИТЕЛЯ, здесь этим не подменяем.
export async function canManageFinance(user: { id: string; systemRole: SystemRole }): Promise<boolean> {
  if (canManageOperations(user)) return true;
  const managed = await prisma.department.findFirst({
    where: { managerId: user.id, code: "ADM" },
    select: { id: true },
  });
  return !!managed;
}
