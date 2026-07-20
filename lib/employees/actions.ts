"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { SystemRole, UserType } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Добавлять сотрудников может только РУКОВОДИТЕЛЬ — управление
// персоналом это его зона ответственности (см. бриф).
export async function createEmployeeAction(formData: FormData) {
  const session = await auth();
  if (session?.user.systemRole !== SystemRole.РУКОВОДИТЕЛЬ) {
    throw new Error("Недостаточно прав");
  }

  const fullName = (formData.get("fullName") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;
  const systemRole = formData.get("systemRole") as SystemRole | null;
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

  if (!fullName || !email || !password) {
    throw new Error("Заполните все обязательные поля");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Сотрудник с таким email уже существует");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      systemRole: systemRole ?? SystemRole.СОТРУДНИК,
      userType: UserType.ШТАТНЫЙ,
      phone,
      position,
      birthDate,
      salary,
    },
  });

  revalidatePath("/employees");
  revalidatePath("/projects");
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
  if (!session?.user || session.user.systemRole !== SystemRole.РУКОВОДИТЕЛЬ) {
    throw new Error("Недостаточно прав");
  }
  if (session.user.id === userId) {
    throw new Error("Нельзя удалить свой собственный аккаунт");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
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
    await tx.task.updateMany({
      where: { assigneeMember: { userId } },
      data: { assigneeMemberId: null },
    });
    await tx.projectMember.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  revalidatePath("/employees");
  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/employees");
}

function isSelfOrHead(sessionUser: { id: string; systemRole: SystemRole }, targetUserId: string) {
  return sessionUser.id === targetUserId || sessionUser.systemRole === SystemRole.РУКОВОДИТЕЛЬ;
}

// Контактные данные (email/телефон) — их может менять сам сотрудник в
// своём кабинете или руководитель (в чужом). Остальные, "кадровые",
// поля — только руководитель, см. updateEmployeeDetailsAction.
export async function updateEmployeeContactAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId || !isSelfOrHead(session.user, userId)) {
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

// ФИО/должность/оклад/системная роль — кадровые данные, редактирует
// только руководитель (даже в собственном кабинете сотрудник их не трогает).
export async function updateEmployeeDetailsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.systemRole !== SystemRole.РУКОВОДИТЕЛЬ) {
    throw new Error("Недостаточно прав");
  }

  const userId = formData.get("userId") as string | null;
  if (!userId) {
    throw new Error("Не указан сотрудник");
  }

  const fullName = (formData.get("fullName") as string | null)?.trim();
  const position = (formData.get("position") as string | null)?.trim() || null;
  const birthDateRaw = formData.get("birthDate") as string | null;
  const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;
  const systemRole = formData.get("systemRole") as SystemRole | null;

  if (!fullName) {
    throw new Error("ФИО обязательно");
  }

  const salaryRaw = (formData.get("salary") as string | null)?.trim();
  let salary: number | null = null;
  if (salaryRaw) {
    salary = Number(salaryRaw);
    if (Number.isNaN(salary) || salary <= 0) {
      throw new Error("Оклад должен быть положительным числом");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      fullName,
      position,
      birthDate,
      salary,
      systemRole: systemRole ?? undefined,
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
  if (!userId || !isSelfOrHead(session.user, userId)) {
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
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  revalidatePath(`/employees/${userId}`);
}
