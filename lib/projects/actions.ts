"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PaymentType, ProjectRole, ProjectStatus, SectionStatus, TaskPriority } from "@prisma/client";
import { del } from "@vercel/blob";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity/log";
import { sendGipAssignedEmail, sendTaskAssignedEmail } from "@/lib/email/send";
import { appendProjectRow, syncProjectField } from "@/lib/google-sheets";
import { notifyGipAssigned, notifyTaskAssigned } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import { ensureProjectMember } from "@/lib/projects/membership";
import {
  canManageOperations,
  userManagesAnyDepartment,
  userManagesDepartmentInProject,
} from "@/lib/projects/permissions";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";

const TASK_PRIORITY_VALUES = new Set<string>(Object.values(TaskPriority));

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

// Данные по одному департаменту, выбранному при создании проекта — какие
// пункты его базового стека отмечены, какие свои задачи добавлены, кто
// контактное лицо департамента на этом проекте (шаг 3 мастера, см. план
// D7) и кому/когда/с каким приоритетом назначена каждая задача (шаг 5,
// D8/D9). Присылаются клиентом как JSON в скрытом поле `deptData_<id>`
// (обычная FormData не умеет вкладывать структуры), см. new-project-dialog.tsx.
// Заголовок/описание задач из базового стека НИКОГДА не берём из этого
// JSON — только реальные id, а тексты подтягиваем заново из БД, чтобы
// клиент не мог подменить содержимое задачи через devtools.
// taskAssignments ключуется по item.id (пункт стека) или customTask.key
// (свои задачи — стабильный клиентский ключ, НЕ индекс массива, чтобы
// удаление одной кастомной задачи не сдвигало назначения у остальных).
type TaskAssignmentInput = { assigneeUserId?: string; deadline?: string; priority?: string };

type DepartmentTaskSelection = {
  checkedTemplateItemIds: string[];
  // Подпункты (чек-лист) отмеченных пунктов стека — плоский набор id-шников,
  // без привязки к конкретному родителю (id подпунктов глобально уникальны),
  // см. new-project-dialog.tsx StepDepartmentTaskPicker.
  checkedSubItemIds: string[];
  customTasks: { key: string; title: string }[];
  contactManagerId: string | null;
  taskAssignments: Record<string, TaskAssignmentInput>;
};

function parseDepartmentTaskSelection(raw: string | null): DepartmentTaskSelection {
  const empty: DepartmentTaskSelection = {
    checkedTemplateItemIds: [],
    checkedSubItemIds: [],
    customTasks: [],
    contactManagerId: null,
    taskAssignments: {},
  };
  if (!raw) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Некорректные данные задач департамента");
  }
  const obj = parsed as {
    checkedTemplateItemIds?: unknown;
    checkedSubItemIds?: unknown;
    customTasks?: unknown;
    contactManagerId?: unknown;
    taskAssignments?: unknown;
  };

  const checkedTemplateItemIds = Array.isArray(obj.checkedTemplateItemIds)
    ? obj.checkedTemplateItemIds.filter((v): v is string => typeof v === "string")
    : [];

  const checkedSubItemIds = Array.isArray(obj.checkedSubItemIds)
    ? obj.checkedSubItemIds.filter((v): v is string => typeof v === "string")
    : [];

  const customTasks = Array.isArray(obj.customTasks)
    ? obj.customTasks
        .filter(
          (v): v is { key: unknown; title: unknown } =>
            typeof v === "object" && v !== null && "key" in v && "title" in v,
        )
        .map((v) => ({ key: String(v.key), title: String(v.title).trim() }))
        .filter((v) => v.title.length > 0)
    : [];

  const contactManagerId =
    typeof obj.contactManagerId === "string" && obj.contactManagerId.trim()
      ? obj.contactManagerId.trim()
      : null;

  const taskAssignments: Record<string, TaskAssignmentInput> = {};
  if (obj.taskAssignments && typeof obj.taskAssignments === "object") {
    for (const [key, value] of Object.entries(obj.taskAssignments as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as { assigneeUserId?: unknown; deadline?: unknown; priority?: unknown };
      taskAssignments[key] = {
        assigneeUserId: typeof v.assigneeUserId === "string" && v.assigneeUserId ? v.assigneeUserId : undefined,
        deadline: typeof v.deadline === "string" && v.deadline ? v.deadline : undefined,
        priority: typeof v.priority === "string" && v.priority ? v.priority : undefined,
      };
    }
  }

  return { checkedTemplateItemIds, checkedSubItemIds, customTasks, contactManagerId, taskAssignments };
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
  const managesAnyDepartment = await userManagesAnyDepartment(session.user);
  if (!canManageOperations(session.user, managesAnyDepartment)) {
    throw new Error("Создавать проекты может только руководитель");
  }

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) {
    throw new Error("Название проекта обязательно");
  }

  // Шаг 1 мастера — все необязательны (см. план, Phase 13).
  const client = (formData.get("client") as string | null)?.trim() || null;
  const location = (formData.get("location") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const startDateRaw = formData.get("startDate") as string | null;
  const endDateRaw = formData.get("endDate") as string | null;
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;

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

  // Порядок департаментов — по их orderIndex (canonical), а не по порядку
  // кликов пользователя, чтобы список разделов/Гантт выглядел предсказуемо.
  // employees нужны для проверки на сервере, что исполнитель задачи (шаг 5)
  // реально состоит в ЭТОМ департаменте (D9) — клиентский пикер это уже
  // ограничивает, но это не замена серверной проверке.
  const selectedDepartmentIds = formData.getAll("departmentIds") as string[];
  const selectedDepartments =
    selectedDepartmentIds.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: selectedDepartmentIds } },
          select: {
            id: true,
            name: true,
            orderIndex: true,
            // Только верхнего уровня — их подпункты (чек-лист) вложены в
            // subItems, дальше не разворачиваются (2 уровня максимум).
            taskTemplateItems: {
              where: { parentItemId: null },
              select: {
                id: true,
                title: true,
                description: true,
                subItems: { select: { id: true, title: true }, orderBy: { orderIndex: "asc" } },
              },
            },
            employees: { select: { id: true } },
          },
          orderBy: { orderIndex: "asc" },
        })
      : [];

  type TaskPlan = {
    key: string;
    title: string;
    description: string | null;
    assigneeUserId: string | null;
    deadline: Date | null;
    priority: TaskPriority;
    checklistTitles: string[];
  };

  function buildTaskPlan(
    key: string,
    title: string,
    description: string | null,
    assignment: TaskAssignmentInput | undefined,
    employeeIds: Set<string>,
    checklistTitles: string[] = [],
  ): TaskPlan {
    const assigneeUserId = assignment?.assigneeUserId?.trim() || null;
    if (assigneeUserId && !employeeIds.has(assigneeUserId)) {
      throw new Error("Исполнитель задачи должен быть сотрудником выбранного департамента");
    }
    const priorityRaw = assignment?.priority || TaskPriority.СРЕДНИЙ;
    if (!TASK_PRIORITY_VALUES.has(priorityRaw)) {
      throw new Error("Некорректный приоритет задачи");
    }
    const deadlineRaw = assignment?.deadline || null;
    return {
      key,
      title,
      description,
      assigneeUserId,
      deadline: deadlineRaw ? new Date(deadlineRaw) : null,
      priority: priorityRaw as TaskPriority,
      checklistTitles,
    };
  }

  const sectionPlans = selectedDepartments.map((department) => {
    const selection = parseDepartmentTaskSelection(
      formData.get(`deptData_${department.id}`) as string | null,
    );
    const checkedIds = new Set(selection.checkedTemplateItemIds);
    const checkedSubItemIds = new Set(selection.checkedSubItemIds);
    const employeeIds = new Set(department.employees.map((e) => e.id));

    const tasks: TaskPlan[] = [];
    for (const item of department.taskTemplateItems) {
      if (checkedIds.has(item.id)) {
        const checklistTitles = item.subItems
          .filter((sub) => checkedSubItemIds.has(sub.id))
          .map((sub) => sub.title);
        tasks.push(
          buildTaskPlan(
            item.id,
            item.title,
            item.description,
            selection.taskAssignments[item.id],
            employeeIds,
            checklistTitles,
          ),
        );
      }
    }
    for (const custom of selection.customTasks) {
      tasks.push(
        buildTaskPlan(custom.key, custom.title, null, selection.taskAssignments[custom.key], employeeIds),
      );
    }

    return {
      departmentId: department.id,
      name: department.name,
      contactManagerId: selection.contactManagerId,
      tasks,
    };
  });

  // Кому назначены задачи — нужны email/имя для писем после коммита, и
  // сами id, чтобы найти-или-создать ProjectMember (см. ensureProjectMember).
  const distinctAssigneeUserIds = Array.from(
    new Set(
      sectionPlans.flatMap((plan) => plan.tasks.map((task) => task.assigneeUserId).filter((id): id is string => id !== null)),
    ),
  );
  const assigneeUsers =
    distinctAssigneeUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: distinctAssigneeUserIds } },
          select: { id: true, email: true, fullName: true },
        })
      : [];
  const assigneeUserById = new Map(assigneeUsers.map((u) => [u.id, u]));

  const binIin = (formData.get("binIin") as string | null)?.trim() || null;

  const totalAmountRaw = (formData.get("totalAmount") as string | null)?.trim();
  let totalAmount: number | null = null;
  if (totalAmountRaw) {
    totalAmount = Number(totalAmountRaw);
    if (Number.isNaN(totalAmount) || totalAmount <= 0) {
      throw new Error("Некорректная стоимость договора");
    }
  }

  // БИН относится к договору — без стоимости договора его не из чего
  // создать (Contract.totalAmount обязателен в схеме), поэтому без
  // totalAmount это поле было бы молча потеряно. Заказчик (client) — теперь
  // поле самого проекта (шаг 1), от totalAmount не зависит (см. план, D6).
  if (binIin && totalAmount === null) {
    throw new Error("Чтобы указать БИН, укажите и стоимость договора");
  }

  const creatorIsGip = gipUserId === session.user.id;

  const assignedTaskEmails: {
    to: string;
    employeeName: string;
    taskTitle: string;
    deadline: Date | null;
  }[] = [];

  const createdProject = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: { name, client, location, startDate, endDate, description },
    });

    const gipMember = await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: gipUserId,
        projectRole: ProjectRole.ГИП,
      },
    });
    await notifyGipAssigned(tx, { userId: gipUserId, actorId: session.user.id, projectName: name });

    const creatorMember = creatorIsGip
      ? gipMember
      : await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: session.user.id,
            projectRole: ProjectRole.МЕНЕДЖЕР,
          },
        });

    // Шаг 5: каждый отдельно назначенный исполнитель должен стать участником
    // проекта, чтобы Task.assigneeMemberId на него сослался (см. план, D8).
    // Роль ИНЖЕНЕР только при реальном создании — если человек уже участник
    // (например, сам ГИП или создатель), его роль не понижаем.
    const memberIdByUserId = new Map<string, string>();
    for (const userId of distinctAssigneeUserIds) {
      const { member } = await ensureProjectMember(tx, {
        projectId: project.id,
        userId,
        role: ProjectRole.ИНЖЕНЕР,
        actorId: session.user.id,
        projectName: name,
      });
      memberIdByUserId.set(userId, member.id);
    }

    for (const [index, plan] of sectionPlans.entries()) {
      const section = await tx.section.create({
        data: {
          projectId: project.id,
          departmentId: plan.departmentId,
          name: plan.name,
          orderIndex: index,
          contactManagerId: plan.contactManagerId,
        },
      });

      for (const taskPlan of plan.tasks) {
        const assigneeMemberId = taskPlan.assigneeUserId
          ? (memberIdByUserId.get(taskPlan.assigneeUserId) ?? null)
          : null;

        const task = await tx.task.create({
          data: {
            sectionId: section.id,
            title: taskPlan.title,
            description: taskPlan.description,
            priority: taskPlan.priority,
            deadline: taskPlan.deadline,
            assigneeMemberId,
            assignedByUserId: session.user.id,
          },
        });

        if (taskPlan.checklistTitles.length > 0) {
          await tx.taskChecklistItem.createMany({
            data: taskPlan.checklistTitles.map((title, index) => ({
              taskId: task.id,
              title,
              orderIndex: index,
            })),
          });
        }

        if (assigneeMemberId && taskPlan.assigneeUserId) {
          await notifyTaskAssigned(tx, {
            userId: taskPlan.assigneeUserId,
            actorId: session.user.id,
            taskId: task.id,
            taskTitle: task.title,
            projectName: name,
          });

          const assigneeUser = assigneeUserById.get(taskPlan.assigneeUserId);
          if (assigneeUser) {
            assignedTaskEmails.push({
              to: assigneeUser.email,
              employeeName: assigneeUser.fullName,
              taskTitle: task.title,
              deadline: taskPlan.deadline,
            });
          }
        }
      }
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
          clientName: client ?? "Не указан",
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

    return project;
  });

  // Письма — уже после того, как проект реально создан и закоммичен;
  // если почта недоступна или упадёт, это не должно откатывать проект,
  // поэтому не в транзакции и без throw наружу.
  for (const emailPayload of assignedTaskEmails) {
    sendTaskAssignedEmail({
      to: emailPayload.to,
      employeeName: emailPayload.employeeName,
      taskTitle: emailPayload.taskTitle,
      projectName: name,
      deadline: emailPayload.deadline,
    }).catch((error) => {
      console.error("Не удалось отправить уведомление о назначении задачи", error);
    });
  }
  sendGipAssignedEmail({
    to: gipUser.email,
    employeeName: gipUser.fullName,
    projectName: name,
    assignedByName: session.user.name ?? "Руководитель",
  }).catch((error) => {
    console.error("Не удалось отправить уведомление о назначении ГИП", error);
  });

  // Экспорт в Google Sheets — как и письма, после коммита и без throw
  // наружу: недоступность таблицы не должна откатывать создание проекта.
  appendProjectRow({
    id: createdProject.id,
    name,
    client,
    location,
    startDate,
    endDate,
    description,
    gipName: gipUser.fullName,
    createdByName: session.user.name ?? "Руководитель",
    statusLabel: PROJECT_STATUS_LABELS[createdProject.status],
    createdAt: createdProject.createdAt,
  }).catch((error) => {
    console.error("Не удалось экспортировать проект в Google Sheets", error);
  });

  revalidatePath("/projects");
  revalidatePath("/");
}

export async function updateProjectNameAction(projectId: string, name: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const managesThisProject = await userManagesDepartmentInProject(session.user, projectId);
  if (!canManageOperations(session.user, managesThisProject)) {
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

  syncProjectField(projectId, "name", trimmedName).catch((error) => {
    console.error("Не удалось обновить название проекта в Google Sheets", error);
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

// Назначить/сменить ГИП можно и после создания проекта (изначально это
// было только в мастере создания). Если у проекта уже был другой ГИП —
// он не выпадает из проекта, а становится МЕНЕДЖЕРОМ (та же логика,
// что и в createProjectAction для создателя-не-ГИПа): так не теряется
// его связь с уже созданными на нём договорами (createdByMemberId).
export async function assignGipAction(projectId: string, gipUserId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const managesThisProject = await userManagesDepartmentInProject(session.user, projectId);
  if (!canManageOperations(session.user, managesThisProject)) {
    throw new Error("Назначать ГИП может только руководитель");
  }

  const [project, gipUser] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: gipUserId }, select: { id: true, fullName: true } }),
  ]);
  if (!project) {
    throw new Error("Проект не найден");
  }
  if (!gipUser) {
    throw new Error("Выбранный сотрудник не найден");
  }

  const changed = await prisma.$transaction(async (tx) => {
    const currentGip = await tx.projectMember.findFirst({
      where: { projectId, projectRole: ProjectRole.ГИП },
    });

    if (currentGip?.userId === gipUserId) {
      return false;
    }

    if (currentGip) {
      await tx.projectMember.update({
        where: { id: currentGip.id },
        data: { projectRole: ProjectRole.МЕНЕДЖЕР },
      });
    }

    const existingMembership = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: gipUserId } },
    });

    if (existingMembership) {
      await tx.projectMember.update({
        where: { id: existingMembership.id },
        data: { projectRole: ProjectRole.ГИП },
      });
    } else {
      await tx.projectMember.create({
        data: { projectId, userId: gipUserId, projectRole: ProjectRole.ГИП },
      });
    }

    await notifyGipAssigned(tx, { userId: gipUserId, actorId: session.user.id, projectName: project.name });

    await logActivity(tx, {
      projectId,
      actorId: session.user.id,
      message: `${session.user.name} назначил(а) ${gipUser.fullName} ГИП-ом проекта «${project.name}»`,
    });

    return true;
  });

  if (changed) {
    syncProjectField(projectId, "gip", gipUser.fullName).catch((error) => {
      console.error("Не удалось обновить ГИП проекта в Google Sheets", error);
    });
  }

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
//
// Сознательно НЕ трогаем строку проекта в Google Sheets здесь — по
// требованию Камилы таблица служит подстраховкой на случай недоступности
// сайта, и информация в ней никогда не должна удаляться, даже если сам
// проект удалили в приложении.
export async function deleteProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const managesThisProject = await userManagesDepartmentInProject(session.user, projectId);
  if (!canManageOperations(session.user, managesThisProject)) {
    throw new Error("Удалять проект может только руководитель");
  }

  // Файлы в Blob удаляются best-effort уже после коммита транзакции (см.
  // конец функции) — сначала собираем их URL, пока строки Document ещё
  // не удалены.
  const attachments = await prisma.document.findMany({
    where: { OR: [{ section: { projectId } }, { task: { section: { projectId } } }] },
    select: { fileUrl: true },
  });

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
    await tx.notification.deleteMany({ where: { task: { section: { projectId } } } });
    await tx.document.deleteMany({
      where: { OR: [{ section: { projectId } }, { task: { section: { projectId } } }] },
    });
    await tx.taskChecklistItem.deleteMany({ where: { task: { section: { projectId } } } });
    await tx.task.deleteMany({ where: { section: { projectId } } });
    await tx.section.deleteMany({ where: { projectId } });

    await tx.activityLog.deleteMany({ where: { projectId } });
    await tx.projectMember.deleteMany({ where: { projectId } });

    await tx.project.delete({ where: { id: projectId } });
  });

  for (const attachment of attachments) {
    del(attachment.fileUrl).catch((error) => {
      console.error("Не удалось удалить файл из Blob", error);
    });
  }

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

  const managesThisProject = await userManagesDepartmentInProject(session.user, projectId);
  if (!canManageOperations(session.user, managesThisProject)) {
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

  syncProjectField(projectId, "status", PROJECT_STATUS_LABELS[status]).catch((error) => {
    console.error("Не удалось обновить статус проекта в Google Sheets", error);
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
    include: {
      project: { select: { id: true, name: true } },
      department: { select: { managerId: true } },
    },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }

  const managesThisSection = section.department?.managerId === session.user.id;
  if (!canManageOperations(session.user, managesThisSection)) {
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
    select: { projectId: true, department: { select: { managerId: true } } },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }

  const managesThisSection = section.department?.managerId === session.user.id;
  if (!canManageOperations(session.user, managesThisSection)) {
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
