import { SystemRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Вся операционная часть (смена статусов проектов/разделов, создание
// новых проектов, назначение ГИП) — раньше была только у администратора
// компании. По прямой просьбе Камилы открыта ЕЩЁ и руководителю ЛЮБОГО
// департамента — сразу как его назначили, без ожидания отдельного
// разрешения на каждый проект: он получает те же права на проекты
// компании, что и администратор. `managesAnyDepartment` вызывающий код
// вычисляет ОДИН раз за запрос (см. userManagesAnyDepartment) и
// прокидывает сюда, а не пересчитывает на каждый вызов — иначе при
// проверке прав на список из многих разделов/задач это был бы N+1
// запросов к базе.
export function canManageOperations(
  user: { systemRole: SystemRole },
  managesAnyDepartment = false,
) {
  return user.systemRole === SystemRole.РУКОВОДИТЕЛЬ || managesAnyDepartment;
}

// Вычисляется один раз на запрос (страница/server action), а не заново
// для каждой проверки прав внутри него — см. canManageOperations выше.
export async function userManagesAnyDepartment(user: { id: string }): Promise<boolean> {
  const managed = await prisma.department.findFirst({
    where: { managerId: user.id },
    select: { id: true },
  });
  return !!managed;
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
