"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { SystemRole, UserType } from "@prisma/client";
import { del } from "@vercel/blob";

import { auth } from "@/auth";
import { generateTemporaryPassword } from "@/lib/auth/generate-temporary-password";
import { isPrivilegedOverride, recordAuditLog } from "@/lib/audit/log";
import { sendEmployeeCreatedEmail, sendPasswordResetEmail, sendPositionChangedEmail } from "@/lib/email/send";
import { notifyEmployeeCreated, notifyPasswordReset, notifyPositionChanged } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import { canManageFinance } from "@/lib/projects/permissions";
import { isFullAdmin } from "@/lib/auth/roles";

// Полный контроль над своим департаментом (см. план): руководитель
// департамента может создавать сотрудников, но только в СВОЁМ департаменте,
// всегда с ролью СОТРУДНИК. АДМИН и РУКОВОДИТЕЛЬ (обе системные роли, см.
// schema.prisma) создают сотрудников без ограничения по департаменту —
// но назначить через эту форму НЕ базовую системную роль (СОТРУДНИК) может
// только АДМИН: смена системных ролей — зона ответственности исключительно
// администратора (иначе РУКОВОДИТЕЛЬ мог бы сам себе/другим выдавать
// повышенные права в обход "Кадровых данных").
export async function createEmployeeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const isAdmin = isFullAdmin(session.user.systemRole);
  const isElevated =
    isAdmin || session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ || !!session.user.isProjectLead;
  let scopedDepartmentId: string | null = null;
  let scopedDepartmentName: string | null = null;
  if (!isElevated) {
    const managed = await prisma.department.findFirst({
      where: { managers: { some: { id: session.user.id } } },
      select: { id: true, name: true },
    });
    if (!managed) {
      throw new Error("Недостаточно прав");
    }
    scopedDepartmentId = managed.id;
    scopedDepartmentName = managed.name;
  }

  const fullName = (formData.get("fullName") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const systemRole = isAdmin
    ? ((formData.get("systemRole") as SystemRole | null) ?? SystemRole.СОТРУДНИК)
    : SystemRole.СОТРУДНИК;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const position = (formData.get("position") as string | null)?.trim() || null;
  const birthDateRaw = formData.get("birthDate") as string | null;
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;

  if (!fullName || !email) {
    throw new Error("Заполните все обязательные поля");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Сотрудник с таким email уже существует");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        systemRole,
        userType: UserType.ШТАТНЫЙ,
        phone,
        position,
        birthDate,
        homeDepartmentId: scopedDepartmentId,
      },
    });

    await notifyEmployeeCreated(tx, {
      userId: created.id,
      actorId: session.user.id,
      departmentName: scopedDepartmentName,
    });

    return created;
  });

  // Как и у руководителей (см. lib/managers/actions.ts): пароль генерируется
  // на сервере, администратор его не вводит и не видит — уходит только
  // письмом (было наоборот до объединения флоу, см. git log).
  sendEmployeeCreatedEmail({
    to: user.email,
    employeeName: user.fullName,
    temporaryPassword,
    departmentName: scopedDepartmentName,
  }).catch((error) => {
    console.error("Не удалось отправить приветственное письмо", error);
  });

  revalidatePath("/employees");
  revalidatePath("/projects");
  if (scopedDepartmentId) {
    revalidatePath(`/departments/${scopedDepartmentId}`);
  }
}

// Обратимая альтернатива удалению (Task 1.2, PRD #3 Phase 2) — та же
// проверка прав, что и раньше у deleteEmployeeAction (администратор или
// руководитель ЭТОГО департамента), но здесь можно и отменить. Задачи
// деактивированного сотрудника НЕ трогаем (см. deactivateManagerAction —
// тот же принцип): он просто не может войти, история и назначения
// остаются как есть.
async function assertCanArchiveEmployee(
  sessionUser: { id: string; systemRole: SystemRole; isProjectLead?: boolean },
  userId: string,
) {
  if (sessionUser.id === userId) {
    throw new Error("Нельзя изменить статус своего собственного аккаунта");
  }
  const isElevated =
    isFullAdmin(sessionUser.systemRole) ||
    sessionUser.systemRole === SystemRole.РУКОВОДИТЕЛЬ ||
    !!sessionUser.isProjectLead;
  if (isElevated) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { homeDepartmentId: true } });
  const managed = await prisma.department.findFirst({
    where: { managers: { some: { id: sessionUser.id } } },
    select: { id: true },
  });
  if (!user || !managed || user.homeDepartmentId !== managed.id) {
    throw new Error("Недостаточно прав");
  }
}

export async function deactivateEmployeeAction(userId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  await assertCanArchiveEmployee(session.user, userId);

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

  revalidatePath("/employees");
  revalidatePath(`/employees/${userId}`);
}

export async function reactivateEmployeeAction(userId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  await assertCanArchiveEmployee(session.user, userId);

  await prisma.user.update({ where: { id: userId }, data: { isActive: true } });

  revalidatePath("/employees");
  revalidatePath(`/employees/${userId}`);
}

// Жёсткое удаление User заблокировано, если на него ссылаются записи с
// обязательным (NOT NULL) внешним ключом — Contract.createdByMemberId,
// DigitalSignature.signedByMemberId (через ProjectMember), а также
// Document.uploadedBy и Comment.authorId (напрямую на User). Это не
// "принадлежащие" сотруднику данные, как разделы у проекта, а общая
// история компании — каскадом их удалять нельзя, поэтому вместо этого
// понятная ошибка с просьбой сначала разобраться с этими записями.
// Task.assigneeMemberId — необязательное поле, поэтому не блокирует,
// просто снимаем назначение.
//
// Task 1.2 (PRD #3 Phase 2): раньше это было доступно и руководителю
// департамента сотрудника — теперь ТОЛЬКО администратору. Обычное
// "убрать сотрудника" — это деактивация (см. deactivateEmployeeAction
// выше), жёсткое удаление — редкое, необратимое действие, поэтому уже
// администратор + запись в аудит-лог.
export async function deleteEmployeeAction(userId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (session.user.id === userId) {
    throw new Error("Нельзя удалить свой собственный аккаунт");
  }
  if (!isFullAdmin(session.user.systemRole)) {
    throw new Error("Удалять сотрудников безвозвратно может только администратор");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      homeDepartmentId: true,
      _count: { select: { documentsUploaded: true, comments: true } },
      projectMemberships: {
        select: {
          _count: { select: { contractsCreated: true, digitalSignatures: true } },
        },
      },
    },
  });
  if (!user) {
    throw new Error("Сотрудник не найден");
  }

  const contractsCreated = user.projectMemberships.reduce(
    (sum, member) => sum + member._count.contractsCreated,
    0,
  );
  const signaturesSigned = user.projectMemberships.reduce(
    (sum, member) => sum + member._count.digitalSignatures,
    0,
  );

  const blockers: string[] = [];
  if (contractsCreated > 0) blockers.push(`создал(а) ${contractsCreated} договор(ов)`);
  if (signaturesSigned > 0) blockers.push(`подписал(а) ${signaturesSigned} документ(ов) ЭЦП`);
  if (user._count.documentsUploaded > 0) {
    blockers.push(`загрузил(а) ${user._count.documentsUploaded} файл(ов)`);
  }
  if (user._count.comments > 0) {
    blockers.push(`оставил(а) ${user._count.comments} комментари(ев)`);
  }

  if (blockers.length > 0) {
    throw new Error(
      `Нельзя удалить: сотрудник ${blockers.join(", ")} — эти записи нужно сначала удалить или переназначить.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Аудит-лог ДО удаления строки — targetId у AuditLog это свободная
    // строка (не FK), но actorId ссылается на текущего администратора, а
    // не на удаляемого пользователя, поэтому порядок здесь не важен для
    // целостности — просто держим рядом с самим действием.
    await recordAuditLog(tx, {
      actorId: session.user.id,
      action: "hard_delete",
      targetType: "User",
      targetId: userId,
      isOverride: true,
    });

    await tx.task.updateMany({
      where: { assigneeMember: { userId } },
      data: { assigneeMemberId: null },
    });
    await tx.projectMember.deleteMany({ where: { userId } });
    // Notification.userId — обязательный (RESTRICT) внешний ключ, в отличие
    // от actorId (SET NULL) — без явной очистки удаление упадёт, если у
    // пользователя есть хоть одно полученное уведомление.
    await tx.notification.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  revalidatePath("/employees");
  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/employees");
}

// Сам сотрудник, администратор, или руководитель ЕГО департамента (см.
// план: "полный контроль над своим департаментом") — единая проверка,
// используется контактными данными, кадровыми данными и сбросом пароля.
async function canActOnEmployee(
  sessionUser: { id: string; systemRole: SystemRole; isProjectLead?: boolean },
  targetUserId: string,
) {
  if (sessionUser.id === targetUserId) return true;
  if (
    isFullAdmin(sessionUser.systemRole) ||
    sessionUser.systemRole === SystemRole.РУКОВОДИТЕЛЬ ||
    sessionUser.isProjectLead
  ) {
    return true;
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { homeDepartmentId: true },
  });
  if (!target?.homeDepartmentId) return false;

  const managed = await prisma.department.findFirst({
    where: { id: target.homeDepartmentId, managers: { some: { id: sessionUser.id } } },
    select: { id: true },
  });
  return !!managed;
}

// Task 1.4 (PRD #3 Phase 6, allow-list hardening): в отличие от
// canActOnEmployee выше, здесь сознательно НЕТ self-ветки — "кадровые
// данные" (ФИО/должность/дата рождения/департамент) редактирует
// администратор, руководитель ЕГО департамента или финансовый
// руководитель, но НЕ сам сотрудник (UI это уже скрывает — canEditDetails
// в employees/[id]/page.tsx не включает isSelf, — но до этой правки
// updateEmployeeDetailsAction по ошибке переиспользовал canActOnEmployee
// с его self-веткой, так что прямой вызов action в обход UI позволял
// сотруднику самому себе сменить департамент/ФИО/должность).
async function canManageEmployeeDetails(
  sessionUser: { id: string; systemRole: SystemRole; isProjectLead?: boolean },
  targetUserId: string,
) {
  if (
    isFullAdmin(sessionUser.systemRole) ||
    sessionUser.systemRole === SystemRole.РУКОВОДИТЕЛЬ ||
    sessionUser.isProjectLead
  ) {
    return true;
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { homeDepartmentId: true },
  });
  if (!target?.homeDepartmentId) return false;

  const managed = await prisma.department.findFirst({
    where: { id: target.homeDepartmentId, managers: { some: { id: sessionUser.id } } },
    select: { id: true },
  });
  return !!managed;
}

// Контактные данные (email/телефон) — их может менять сам сотрудник в
// своём кабинете, администратор, или руководитель его департамента.
// Остальные, "кадровые", поля — см. updateEmployeeDetailsAction.
export async function updateEmployeeContactAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId || !(await canActOnEmployee(session.user, userId))) {
    throw new Error("Недостаточно прав");
  }

  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string | null)?.trim() || null;

  if (!email) {
    throw new Error("Email обязателен");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    throw new Error("Этот email уже используется другим сотрудником");
  }

  await prisma.user.update({ where: { id: userId }, data: { email, phone } });

  revalidatePath(`/employees/${userId}`);
  revalidatePath("/employees");
}

// ФИО/должность/дата рождения — редактирует администратор, руководитель
// департамента этого сотрудника, или руководитель Административного
// департамента (canManageFinance — финансово-кадровая зона компании
// целиком, см. lib/projects/permissions.ts). Системная роль — смена
// привилегий, ЗАВЕДОМО только администратор.
export async function updateEmployeeDetailsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId) {
    throw new Error("Не указан сотрудник");
  }

  // Строго АДМИН, не РУКОВОДИТЕЛЬ — смена системной роли/financeAccess
  // (ниже) остаётся исключительно у администратора, иначе РУКОВОДИТЕЛЬ смог
  // бы сам себе/другим выдать полный доступ в обход "Кадровых данных".
  const isAdmin = isFullAdmin(session.user.systemRole);
  const isFinanceManager = await canManageFinance(session.user);

  if (!(await canManageEmployeeDetails(session.user, userId)) && !isFinanceManager) {
    throw new Error("Недостаточно прав");
  }

  const fullName = (formData.get("fullName") as string | null)?.trim();
  const position = (formData.get("position") as string | null)?.trim() || null;
  const birthDateRaw = formData.get("birthDate") as string | null;
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;
  // "Обзор" сотрудника: любой, кто вообще может открыть эту форму
  // (руководитель компании, руководитель ТЕКУЩЕГО департамента сотрудника
  // или финансовый руководитель — см. canActOnEmployee/isFinanceManager
  // выше), может перевести его в ЛЮБОЙ департамент компании, не только
  // между "свой" и "без департамента" — по прямой просьбе Камилы.
  const homeDepartmentIdRaw = (formData.get("homeDepartmentId") as string | null)?.trim() || "";
  const homeDepartmentId =
    homeDepartmentIdRaw && homeDepartmentIdRaw !== "__none__" ? homeDepartmentIdRaw : null;

  if (!fullName) {
    throw new Error("ФИО обязательно");
  }

  if (homeDepartmentId) {
    const department = await prisma.department.findUnique({ where: { id: homeDepartmentId } });
    if (!department) {
      throw new Error("Департамент не найден");
    }
  }

  let systemRole: SystemRole | undefined = undefined;
  let financeAccess: boolean | undefined = undefined;
  let allProjectsAccess: boolean | undefined = undefined;
  if (isAdmin) {
    systemRole = (formData.get("systemRole") as SystemRole | null) ?? undefined;
    financeAccess = formData.get("financeAccess") === "on";
    allProjectsAccess = formData.get("allProjectsAccess") === "on";
  }

  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      homeDepartmentId: true,
      position: true,
      email: true,
      systemRole: true,
      financeAccess: true,
      allProjectsAccess: true,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        fullName,
        position,
        birthDate,
        homeDepartmentId,
        systemRole,
        financeAccess,
        allProjectsAccess,
      },
    });

    // Уведомляем о новой должности — по прямой просьбе Камилы. Не свою же
    // смену (человек сам видит форму) и не "снятие" должности (position:
    // null) — там уведомлять не о чем.
    if (position && position !== previous?.position && userId !== session.user.id) {
      await notifyPositionChanged(tx, { userId, actorId: session.user.id, position });
    }

    // Task 6.3 (аудит-лог): смена системной роли/финансового доступа —
    // только реальное изменение значения (diff old vs new), не каждое
    // сохранение формы.
    if (systemRole !== undefined && systemRole !== previous?.systemRole) {
      await recordAuditLog(tx, {
        actorId: session.user.id,
        action: "employee_role_change",
        targetType: "User",
        targetId: userId,
        isOverride: isPrivilegedOverride(session.user) && userId !== session.user.id,
      });
    }
    if (financeAccess !== undefined && financeAccess !== previous?.financeAccess) {
      await recordAuditLog(tx, {
        actorId: session.user.id,
        action: "employee_finance_access_change",
        targetType: "User",
        targetId: userId,
        isOverride: isPrivilegedOverride(session.user) && userId !== session.user.id,
      });
    }
    if (allProjectsAccess !== undefined && allProjectsAccess !== previous?.allProjectsAccess) {
      await recordAuditLog(tx, {
        actorId: session.user.id,
        action: "employee_all_projects_access_change",
        targetType: "User",
        targetId: userId,
        isOverride: isPrivilegedOverride(session.user) && userId !== session.user.id,
      });
    }
  });

  if (position && position !== previous?.position && userId !== session.user.id && previous?.email) {
    sendPositionChangedEmail({ to: previous.email, employeeName: fullName, position }).catch((error) => {
      console.error("Не удалось отправить письмо о смене должности", error);
    });
  }

  revalidatePath(`/employees/${userId}`);
  revalidatePath("/employees");
  revalidatePath("/departments");
  if (previous?.homeDepartmentId) revalidatePath(`/departments/${previous.homeDepartmentId}`);
  if (homeDepartmentId) revalidatePath(`/departments/${homeDepartmentId}`);
}

// Лёгкая версия updateEmployeeDetailsAction выше — только должность, без
// остальных обязательных полей формы (ФИО и т.п.). Нужна для диалога
// "Убрать из руководителей" (см. remove-from-managers-dialog.tsx): там
// админ может сразу поменять должность человеку, которого только что
// понизил, не заполняя всю форму "Кадровых данных" целиком.
export async function updatePositionAction(userId: string, position: string | null) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!(await canManageEmployeeDetails(session.user, userId))) {
    throw new Error("Недостаточно прав");
  }

  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { position: true, email: true, fullName: true },
  });
  if (!previous) {
    throw new Error("Сотрудник не найден");
  }

  await prisma.user.update({ where: { id: userId }, data: { position } });

  if (position && position !== previous.position && userId !== session.user.id) {
    await notifyPositionChanged(prisma, { userId, actorId: session.user.id, position });
    if (previous.email) {
      sendPositionChangedEmail({ to: previous.email, employeeName: previous.fullName, position }).catch(
        (error) => {
          console.error("Не удалось отправить письмо о смене должности", error);
        },
      );
    }
  }

  revalidatePath(`/employees/${userId}`);
  revalidatePath("/employees");
  revalidatePath("/managers");
}

// Сам сотрудник обязан подтвердить текущий пароль (проверка личности).
// Руководитель, сбрасывающий пароль ДРУГОГО сотрудника, текущий пароль
// не знает и не должен вводить — это административный сброс.
export async function changePasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId || !(await canActOnEmployee(session.user, userId))) {
    throw new Error("Недостаточно прав");
  }

  const newPassword = formData.get("newPassword") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Пароль должен быть не короче 6 символов");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("Пароли не совпадают");
  }

  const isSelf = session.user.id === userId;
  if (isSelf) {
    const currentPassword = formData.get("currentPassword") as string | null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("Пользователь не найден");
    }
    const matches = currentPassword
      ? await bcrypt.compare(currentPassword, user.passwordHash)
      : false;
    if (!matches) {
      throw new Error("Текущий пароль указан неверно");
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    // Только административный сброс ЧУЖОГО пароля — самостоятельная смена
    // пароля никого не уведомляет (см. lib/notifications/notify.ts).
    if (!isSelf) {
      await notifyPasswordReset(tx, { userId, actorId: session.user.id });
    }
  });

  if (!isSelf) {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });
    if (target) {
      sendPasswordResetEmail({
        to: target.email,
        employeeName: target.fullName,
        temporaryPassword: newPassword,
      }).catch((error) => {
        console.error("Не удалось отправить письмо о сбросе пароля", error);
      });
    }
  }

  revalidatePath(`/employees/${userId}`);
}

// Аватар — только свой собственный: ни руководитель, ни кто-либо ещё не
// редактирует чужое фото (в отличие от кадровых полей). userId сверяется
// с сессией, а не просто доверяется параметру — иначе через devtools можно
// было бы подставить чужой id.
export async function updateAvatarAction(userId: string, blobUrl: string) {
  const session = await auth();
  if (!session?.user || session.user.id !== userId) {
    throw new Error("Недостаточно прав");
  }

  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: blobUrl } });

  // Старый файл в Blob больше не нужен — удаляем best-effort, как и письма:
  // если не получилось (сеть, файл уже удалён), это не должно ронять сам
  // экшен, аватар уже сохранён в БД.
  if (previous?.avatarUrl && previous.avatarUrl !== blobUrl) {
    del(previous.avatarUrl).catch((error) => {
      console.error("Не удалось удалить старый аватар из Blob", error);
    });
  }

  revalidatePath("/");
  revalidatePath(`/employees/${userId}`);
}
