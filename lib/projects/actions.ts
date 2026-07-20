"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PaymentType, ProjectRole, ProjectStatus, SectionStatus } from "@prisma/client";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity/log";
import { sendGipAssignedEmail } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/projects/permissions";
import { SECTION_TEMPLATES, sectionTemplateName } from "@/lib/projects/section-templates";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";

// Делим сумму договора на 3 фиксированных транша по стандартной для
// инженерных договоров схеме 40/40/20 (было 33/33/34) — остаток
// округления уходит в последний транш, чтобы сумма трёх платежей всегда
// точно совпадала с totalAmount до тыина. Точные суммы можно
// скорректировать вручную после создания — см. updatePaymentAmountAction
// в lib/contracts/actions.ts.
function splitIntoTranches(totalAmount: number): [number, number, number] {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const avans = round2(totalAmount * 0.4);
  const tranche2 = round2(totalAmount * 0.4);
  const tranche3 = round2(totalAmount - avans - tranche2);
  return [avans, tranche2, tranche3];
}

// Создать проект может только РУКОВОДИТЕЛЬ — операционная часть
// (см. canManageOperations). ГИП — это отдельный человек, которого
// создатель выбирает из списка (не обязательно он сам). Создатель
// ВСЕГДА получает запись в ProjectMember: если он выбрал сам себя ГИПом
// — одна запись с ролью ГИП; если выбрал кого-то другого — выбранный
// получает роль ГИП, а создатель отдельно становится МЕНЕДЖЕРОМ (это
// нужно, например, чтобы было на кого сослаться как на автора договора
// — см. createdByMemberId ниже).
export async function createProjectAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Создавать проекты может только руководитель");
  }

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) {
    throw new Error("Название проекта обязательно");
  }

  const gipUserId = formData.get("gipUserId") as string | null;
  if (!gipUserId) {
    throw new Error("Нужно выбрать ГИП");
  }

  // Нужны email/имя для уведомления о назначении — заодно валидируем,
  // что выбранный ГИП реально существует (иначе ниже упадёт по FK).
  const gipUser = await prisma.user.findUnique({
    where: { id: gipUserId },
    select: { email: true, fullName: true },
  });
  if (!gipUser) {
    throw new Error("Выбранный ГИП не найден");
  }

  const selectedCodes = formData.getAll("sectionTemplates") as string[];
  // Порядок разделов — по каноническому списку шаблонов, а не по
  // порядку кликов пользователя (иначе Гантт будет выглядеть хаотично).
  const orderedTemplates = SECTION_TEMPLATES.filter((template) =>
    selectedCodes.includes(template.code),
  );

  const clientName = (formData.get("clientName") as string | null)?.trim() || null;
  const binIin = (formData.get("binIin") as string | null)?.trim() || null;

  const totalAmountRaw = (formData.get("totalAmount") as string | null)?.trim();
  let totalAmount: number | null = null;
  if (totalAmountRaw) {
    totalAmount = Number(totalAmountRaw);
    if (Number.isNaN(totalAmount) || totalAmount <= 0) {
      throw new Error("Некорректная стоимость договора");
    }
  }

  // Заказчик и БИН относятся к договору — без стоимости договора его не
  // из чего создать (Contract.totalAmount обязателен в схеме), поэтому
  // без totalAmount эти поля были бы молча потеряны.
  if ((clientName || binIin) && totalAmount === null) {
    throw new Error("Чтобы указать заказчика или БИН, укажите и стоимость договора");
  }

  const creatorIsGip = gipUserId === session.user.id;

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({ data: { name } });

    const gipMember = await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: gipUserId,
        projectRole: ProjectRole.ГИП,
      },
    });

    const creatorMember = creatorIsGip
      ? gipMember
      : await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: session.user.id,
            projectRole: ProjectRole.МЕНЕДЖЕР,
          },
        });

    if (orderedTemplates.length > 0) {
      await tx.section.createMany({
        data: orderedTemplates.map((template, index) => ({
          projectId: project.id,
          name: sectionTemplateName(template.code, template.label),
          orderIndex: index,
        })),
      });
    }

    if (totalAmount !== null) {
      // Номер здесь не собирается в этой форме (быстрый мастер проекта) —
      // присваивается автоматически; клиент/БИН можно позже поправить
      // через договор на /contracts.
      const year = new Date().getFullYear();
      const countThisYear = await tx.contract.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const contract = await tx.contract.create({
        data: {
          projectId: project.id,
          createdByMemberId: creatorMember.id,
          number: `ДОГ-${year}-${String(countThisYear + 1).padStart(3, "0")}`,
          clientName: clientName ?? "Не указан",
          totalAmount,
        },
      });

      if (binIin) {
        await tx.requisites.create({
          data: { contractId: contract.id, binIin },
        });
      }

      const [avans, tranche2, tranche3] = splitIntoTranches(totalAmount);
      await tx.payment.createMany({
        data: [
          { contractId: contract.id, paymentType: PaymentType.АВАНС, amount: avans },
          { contractId: contract.id, paymentType: PaymentType.ТРАНШ_2, amount: tranche2 },
          { contractId: contract.id, paymentType: PaymentType.ТРАНШ_3, amount: tranche3 },
        ],
      });
    }
  });

  // Письмо — уже после того, как проект реально создан и закоммичен;
  // если Resend недоступен или упадёт, это не должно откатывать проект,
  // поэтому не в транзакции и без throw наружу.
  sendGipAssignedEmail({
    to: gipUser.email,
    employeeName: gipUser.fullName,
    projectName: name,
    assignedByName: session.user.name ?? "Руководитель",
  }).catch((error) => {
    console.error("Не удалось отправить уведомление о назначении ГИП", error);
  });

  revalidatePath("/projects");
  revalidatePath("/");
}

export async function updateProjectNameAction(projectId: string, name: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Редактировать проект может только руководитель");
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Название проекта обязательно");
  }

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: projectId },
      data: { name: trimmedName },
    });

    await logActivity(tx, {
      projectId,
      actorId: session.user.id,
      message: `${session.user.name} переименовал проект в «${project.name}»`,
    });
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

// Каскадное удаление вручную: в схеме нет onDelete: Cascade (см.
// prisma/schema.prisma), поэтому Postgres запретит удалить проект, пока
// не удалены все зависимые записи. Порядок — от самых "листовых" таблиц
// к корню, чтобы ни один внешний ключ не сослался на уже несуществующую
// строку. Всё в одной транзакции — либо удаляется весь проект целиком,
// либо ничего.
export async function deleteProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!canManageOperations(session.user)) {
    throw new Error("Удалять проект может только руководитель");
  }

  await prisma.$transaction(async (tx) => {
    await tx.closingDocument.deleteMany({ where: { contract: { projectId } } });
    await tx.digitalSignature.deleteMany({ where: { contract: { projectId } } });
    await tx.requisites.deleteMany({ where: { contract: { projectId } } });
    await tx.payment.deleteMany({ where: { contract: { projectId } } });
    await tx.contract.deleteMany({ where: { projectId } });

    await tx.comment.deleteMany({
      where: {
        OR: [
          { projectId },
          { section: { projectId } },
          { task: { section: { projectId } } },
        ],
      },
    });
    await tx.document.deleteMany({ where: { section: { projectId } } });
    await tx.task.deleteMany({ where: { section: { projectId } } });
    await tx.section.deleteMany({ where: { projectId } });

    await tx.activityLog.deleteMany({ where: { projectId } });
    await tx.projectMember.deleteMany({ where: { projectId } });

    await tx.project.delete({ where: { id: projectId } });
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}

// completedAt фиксирует момент закрытия проекта — нужен для статистики
// "завершено в этом году" на дашборде (одного статуса недостаточно,
// т.к. переход мог произойти в любой момент, см. lib/dashboard/queries.ts).
// Если статус уводят обратно из ЗАВЕРШЁН_ПОЛНОСТЬЮ (например, закрыли по
// ошибке), completedAt сбрасывается — проект больше не "завершён".
export async function updateProjectStatusAction(
  projectId: string,
  status: ProjectStatus,
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  if (!canManageOperations(session.user)) {
    throw new Error("Менять статус проекта может только руководитель");
  }

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: projectId },
      data: {
        status,
        completedAt: status === ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ ? new Date() : null,
      },
    });

    await logActivity(tx, {
      projectId,
      actorId: session.user.id,
      message: `${session.user.name} изменил статус проекта «${project.name}» на «${PROJECT_STATUS_LABELS[status]}»`,
    });
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

// Раздел отмечает руководитель (та же операционная зона ответственности,
// что и статус всего проекта), а не система сама — поэтому пишем событие
// в ленту с формулировкой "кто и что сделал", как в примере из брифа
// ("Ахметов Д. отметил раздел АР как выполненный").
export async function updateSectionStatusAction(
  sectionId: string,
  status: SectionStatus,
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }

  if (!canManageOperations(session.user)) {
    throw new Error("Менять статус раздела может только руководитель");
  }

  const message =
    status === SectionStatus.ВЫПОЛНЕНО
      ? `${session.user.name} отметил раздел «${section.name}» как выполненный по проекту «${section.project.name}»`
      : `${session.user.name} вернул раздел «${section.name}» в работу по проекту «${section.project.name}»`;

  await prisma.$transaction(async (tx) => {
    await tx.section.update({ where: { id: sectionId }, data: { status } });
    await logActivity(tx, {
      projectId: section.project.id,
      actorId: session.user.id,
      message,
    });
  });

  revalidatePath("/");
  revalidatePath(`/projects/${section.project.id}`);
}

// Даты раздела — единственный источник данных для Ганта на дашборде
// (см. lib/dashboard/queries.ts, getProjectTimelines): по архитектуре
// (бриф, п.7) Гант не отдельная таблица, а визуализация startDate/deadline
// разделов, поэтому у самого проекта дат нет — только у Section.
export async function updateSectionDatesAction(
  sectionId: string,
  startDate: string | null,
  deadline: string | null,
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { projectId: true },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }

  if (!canManageOperations(session.user)) {
    throw new Error("Менять сроки раздела может только руководитель");
  }

  await prisma.section.update({
    where: { id: sectionId },
    data: {
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  revalidatePath("/");
  revalidatePath(`/projects/${section.projectId}`);
}
