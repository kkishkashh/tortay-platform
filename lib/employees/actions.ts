"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { SystemRole, UserType } from "@prisma/client";
import { del } from "@vercel/blob";

import { auth } from "@/auth";
import { generateTemporaryPassword } from "@/lib/auth/generate-temporary-password";
import { sendEmployeeCreatedEmail, sendPasswordResetEmail } from "@/lib/email/send";
import { notifyEmployeeCreated, notifyPasswordReset } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import { canManageFinance } from "@/lib/projects/permissions";

// Полный контроль над своим департаментом (см. план): руководитель
// департамента может создавать сотрудников, но только в СВОЁМ департаменте,
// всегда с ролью СОТРУДНИК — ни назначить произвольный департамент, ни
// выдать через эту форму системную роль РУКОВОДИТЕЛЬ он не может.
// Администратор (РУКОВОДИТЕЛЬ) — без ограничений, как и раньше.
export async function createEmployeeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const isAdmin = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  let scopedDepartmentId: string | null = null;
  let scopedDepartmentName: string | null = null;
  if (!isAdmin) {
    const managed = await prisma.department.findFirst({
      where: { managerId: session.user.id },
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

  const salaryRaw = (formData.get("salary") as string | null)?.trim();
  let salary: number | null = null;
  if (salaryRaw) {
    salary = Number(salaryRaw);
    if (Number.isNaN(salary) || salary <= 0) {
      throw new Error("Оклад должен быть положительным числом");
    }
  }

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
        salary,
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

// Жёсткое удаление User заблокировано, если на него ссылаются записи с
// обязательным (NOT NULL) внешним ключом — Contract.createdByMemberId,
// DigitalSignature.signedByMemberId (через ProjectMember), а также
// Document.uploadedBy и Comment.authorId (напрямую на User). Это не
// "принадлежащие" сотруднику данные, как разделы у проекта, а общая
// история компании — каскадом их удалять нельзя, поэтому вместо этого
// понятная ошибка с просьбой сначала разобраться с этими записями.
// Task.assigneeMemberId — необязательное поле, поэтому не блокирует,
// просто снимаем назначение.
export async function deleteEmployeeAction(userId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (session.user.id === userId) {
    throw new Error("Нельзя удалить свой собственный аккаунт");
  }

  const isAdmin = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;

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

  if (!isAdmin) {
    const managed = await prisma.department.findFirst({
      where: { managerId: session.user.id },
      select: { id: true },
    });
    if (!managed || user.homeDepartmentId !== managed.id) {
      throw new Error("Недостаточно прав");
    }
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
  sessionUser: { id: string; systemRole: SystemRole },
  targetUserId: string,
) {
  if (sessionUser.id === targetUserId) return true;
  if (sessionUser.systemRole === SystemRole.РУКОВОДИТЕЛЬ) return true;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { homeDepartmentId: true },
  });
  if (!target?.homeDepartmentId) return false;

  const managed = await prisma.department.findFirst({
    where: { id: target.homeDepartmentId, managerId: sessionUser.id },
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
// привилегий, ЗАВЕДОМО только администратор. Оклад — администратор и
// финансовый руководитель (canEditSalary), но не обычный руководитель
// департамента — он чужую зарплату через эту форму не видит.
export async function updateEmployeeDetailsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId) {
    throw new Error("Не указан сотрудник");
  }

  const isAdmin = session.user.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
  const isFinanceManager = await canManageFinance(session.user);

  if (!(await canActOnEmployee(session.user, userId)) && !isFinanceManager) {
    throw new Error("Недостаточно прав");
  }

  const fullName = (formData.get("fullName") as string | null)?.trim();
  const position = (formData.get("position") as string | null)?.trim() || null;
  const birthDateRaw = formData.get("birthDate") as string | null;
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;

  if (!fullName) {
    throw new Error("ФИО обязательно");
  }

  let salary: number | null | undefined = undefined;
  let systemRole: SystemRole | undefined = undefined;
  if (isAdmin || isFinanceManager) {
    const salaryRaw = (formData.get("salary") as string | null)?.trim();
    salary = null;
    if (salaryRaw) {
      salary = Number(salaryRaw);
      if (Number.isNaN(salary) || salary <= 0) {
        throw new Error("Оклад должен быть положительным числом");
      }
    }
  }
  if (isAdmin) {
    systemRole = (formData.get("systemRole") as SystemRole | null) ?? undefined;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      fullName,
      position,
      birthDate,
      salary,
      systemRole,
    },
  });

  revalidatePath(`/employees/${userId}`);
  revalidatePath("/employees");
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
