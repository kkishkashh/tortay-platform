import { SystemRole } from "@prisma/client";

import { isFullAdmin } from "@/lib/auth/roles";

// Шаблон договора общий на всю компанию — смена шаблона разом влияет на
// все будущие договоры, поэтому право уже, чем обычный canManageFinance
// (тот открыт ещё и бухгалтерам с financeAccess, и руководителю ADM-
// департамента). По прямой просьбе (2026-08-06): только Админ/ГЛАВНЫЙ_
// ТЕХНИЧЕСКИЙ_ДИРЕКТОР (через isFullAdmin) или РУКОВОДИТЕЛЬ — не ГИП,
// не Менеджер, не бухгалтер.
export function canManageContractTemplate(user: { systemRole: SystemRole }) {
  return isFullAdmin(user.systemRole) || user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
}
