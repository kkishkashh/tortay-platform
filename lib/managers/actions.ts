"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/departments/permissions";
import { generateTemporaryPassword } from "@/lib/auth/generate-temporary-password";
import { notifyPasswordReset } from "@/lib/notifications/notify";
import { sendPasswordResetEmail } from "@/lib/email/send";

function parseManagerFields(formData: FormData) {
  const fullName = (formData.get("fullName") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const position = (formData.get("position") as string | null)?.trim() || null;
  const usernameRaw = (formData.get("username") as string | null)?.trim();
  const username = usernameRaw || null;

  if (!fullName || !email) {
    throw new Error("ФИО и email обязательны");
  }

  return { fullName, email, phone, position, username };
}

// Только контактные данные — какими департаментами этот человек руководит
// теперь редактируется на странице самого департамента (вкладка
// "Сотрудники"), где сразу видно ВСЕХ его руководителей, а не только
// одного (см. addDepartmentManagerAction/removeDepartmentManagerAction).
export async function updateManagerAction(userId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Редактировать руководителя может только администратор");
  }

  const fields = parseManagerFields(formData);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fields.fullName,
        email: fields.email,
        username: fields.username,
        phone: fields.phone,
        position: fields.position,
      },
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

// Убрать человека из руководителей ВСЕХ департаментов разом — становится
// обычным сотрудником, аккаунт/проекты/история НЕ трогаются. Это
// НЕ то же самое, что deleteManagerAction ниже (тот безвозвратно удаляет
// весь аккаунт) — добавлено после реального инцидента: на этой странице
// была только кнопка "Удалить безвозвратно", и её случайно нажали, желая
// просто снять человека с руководителей (см. историю разработки, 2026-08-05).
export async function removeFromAllManagedDepartmentsAction(userId: string) {
  const session = await auth();
  if (!session?.user || !canManageDepartments(session.user)) {
    throw new Error("Снимать с руководителей может только администратор");
  }

  const departments = await prisma.department.findMany({
    where: { managers: { some: { id: userId } } },
    select: { id: true },
  });

  await Promise.all(
    departments.map((department) =>
      prisma.department.update({
        where: { id: department.id },
        data: { managers: { disconnect: { id: userId } } },
      }),
    ),
  );

  revalidatePath("/managers");
  revalidatePath("/departments");
  revalidatePath("/employees");
  revalidatePath("/");
}

// Тот же принцип блокировки, что и deleteEmployeeAction (lib/employees/actions.ts):
// жёсткое удаление запрещено, если на пользователя ссылаются записи с
// обязательным внешним ключом. Department.managers —m2m с ON DELETE CASCADE
// только на join-таблице (см. миграцию add_multiple_department_managers),
// поэтому руководство департаментом(-ами) само по себе не блокирует удаление.
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
