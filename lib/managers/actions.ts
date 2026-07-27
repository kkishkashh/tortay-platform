"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, SystemRole, UserType } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/departments/permissions";
import { generateTemporaryPassword } from "@/lib/auth/generate-temporary-password";
import { notifyManagerCreated, notifyPasswordReset } from "@/lib/notifications/notify";
import { sendManagerCreatedEmail, sendPasswordResetEmail } from "@/lib/email/send";

function parseManagerFields(formData: FormData) {
  const fullName = (formData.get("fullName") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const position = (formData.get("position") as string | null)?.trim() || null;
  const usernameRaw = (formData.get("username") as string | null)?.trim();
  const username = usernameRaw || null;
  const departmentId = (formData.get("departmentId") as string | null)?.trim() || null;

  if (!fullName || !email) {
    throw new Error("ФИО и email обязательны");
  }

  return { fullName, email, phone, position, username, departmentId };
}

// Создаёт руководителя как обычного User (systemRole: СОТРУДНИК, см. D2 —
// "руководитель" целиком выводится из Department.managerId, отдельного
// системного значения роли для этого нет). Пароль генерируется на сервере
// и никогда не вводится администратором — уходит только письмом.
export async function createManagerAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Создавать руководителей может только администратор");
  }

  const fields = parseManagerFields(formData);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  let departmentName: string | null = null;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: fields.fullName,
          email: fields.email,
          username: fields.username,
          passwordHash,
          systemRole: SystemRole.СОТРУДНИК,
          userType: UserType.ШТАТНЫЙ,
          phone: fields.phone,
          position: fields.position,
        },
      });

      if (fields.departmentId) {
        const department = await tx.department.update({
          where: { id: fields.departmentId },
          data: { managerId: created.id },
          select: { name: true },
        });
        departmentName = department.name;
      }

      await notifyManagerCreated(tx, {
        userId: created.id,
        actorId: session.user.id,
        departmentName,
      });

      return created;
    });

    sendManagerCreatedEmail({
      to: user.email,
      employeeName: user.fullName,
      username: user.username,
      temporaryPassword,
      departmentName,
    }).catch(console.error);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      throw new Error(
        target?.includes("username")
          ? "Этот логин уже используется"
          : "Сотрудник с таким email уже существует",
      );
    }
    throw error;
  }

  revalidatePath("/departments");
  revalidatePath("/employees");
  revalidatePath("/");
}

export async function updateManagerAction(userId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Редактировать руководителя может только администратор");
  }

  const fields = parseManagerFields(formData);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: fields.fullName,
          email: fields.email,
          username: fields.username,
          phone: fields.phone,
          position: fields.position,
        },
      });

      // Один и тот же managerId может стоять только на одном департаменте —
      // сначала снимаем со всех текущих, потом ставим на выбранный.
      await tx.department.updateMany({
        where: { managerId: userId },
        data: { managerId: null },
      });
      if (fields.departmentId) {
        await tx.department.update({
          where: { id: fields.departmentId },
          data: { managerId: userId },
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      throw new Error(
        target?.includes("username")
          ? "Этот логин уже используется"
          : "Этот email уже используется другим сотрудником",
      );
    }
    throw error;
  }

  revalidatePath("/departments");
  revalidatePath("/employees");
  revalidatePath("/");
}

// Тот же принцип блокировки, что и deleteEmployeeAction (lib/employees/actions.ts):
// жёсткое удаление запрещено, если на пользователя ссылаются записи с
// обязательным внешним ключом. Department.managerId — необязательный (см.
// migration.sql: ON DELETE SET NULL), поэтому руководство департаментом
// само по себе не блокирует удаление.
export async function deleteManagerAction(userId: string) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Удалять руководителей может только администратор");
  }
  if (session.user.id === userId) {
    throw new Error("Нельзя удалить свой собственный аккаунт");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: { select: { documentsUploaded: true, comments: true } },
      projectMemberships: {
        select: {
          _count: { select: { contractsCreated: true, digitalSignatures: true } },
        },
      },
    },
  });
  if (!user) {
    throw new Error("Руководитель не найден");
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
      `Нельзя удалить: руководитель ${blockers.join(", ")} — эти записи нужно сначала удалить или переназначить.`,
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

  revalidatePath("/departments");
  revalidatePath("/employees");
  revalidatePath("/");
  redirect("/employees");
}

export async function deactivateManagerAction(userId: string) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Недостаточно прав");
  }
  if (session.user.id === userId) {
    throw new Error("Нельзя деактивировать свой собственный аккаунт");
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

  revalidatePath("/departments");
  revalidatePath("/employees");
  revalidatePath("/");
}

export async function reactivateManagerAction(userId: string) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Недостаточно прав");
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive: true } });

  revalidatePath("/departments");
  revalidatePath("/employees");
  revalidatePath("/");
}

// Административный сброс пароля — генерирует новый временный пароль (та же
// логика, что и при создании), уведомляет и отправляет письмо. В отличие
// от changePasswordAction (lib/employees/actions.ts), текущий пароль не
// требуется — это делает администратор, а не сам пользователь.
export async function resetManagerPasswordAction(userId: string) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Недостаточно прав");
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await notifyPasswordReset(tx, { userId, actorId: session.user.id });

    return updated;
  });

  sendPasswordResetEmail({
    to: user.email,
    employeeName: user.fullName,
    temporaryPassword,
  }).catch(console.error);

  revalidatePath("/departments");
  revalidatePath("/employees");
  revalidatePath("/");
}
