"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  PaymentType,
  ProjectRole,
  ProjectStatus,
  SectionStatus,
  ShiftReasonCategory,
  TaskPriority,
} from "@prisma/client";
import { del } from "@vercel/blob";

import { auth } from "@/auth";
import { logActivity } from "@/lib/activity/log";
import { recordAuditLog } from "@/lib/audit/log";
import { sendGipAssignedEmail, sendTaskAssignedEmail } from "@/lib/email/send";
import { appendProjectRow, syncProjectField } from "@/lib/google-sheets";
import { notifyGipAssigned, notifyTaskAssigned } from "@/lib/notifications/notify";
import { prisma } from "@/lib/prisma";
import { isLeadOfDepartment } from "@/lib/leads/queries";
import { ensureProjectMember } from "@/lib/projects/membership";
import { getSectionDeadlineHistory } from "@/lib/projects/queries";
import {
  canManageOperations,
  userManagesAnyDepartment,
  userManagesDepartmentInProject,
} from "@/lib/projects/permissions";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/status-labels";
import { isFullAdmin } from "@/lib/auth/roles";

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
  // Шаг "Команда" (2026-07-30, по прямой просьбе Камилы) — необязательные
  // Лид и команда проекта по этому департаменту. leadUserId получает
  // ProjectRole.ВЕДУЩИЙ_СПЕЦИАЛИСТ (проектная роль, НЕ то же самое, что
  // персистентная орг-иерархия "Лид" из PRD #3 Phase 3 — см.
  // lib/leads/queries.ts). teamMemberIds получают ИНЖЕНЕР. Оба пусты —
  // как раньше, исполнителя задачи можно назначить кому угодно в
  // департаменте, без предварительного отбора команды.
  leadUserId: string | null;
  teamMemberIds: string[];
  taskAssignments: Record<string, TaskAssignmentInput>;
};

function parseDepartmentTaskSelection(raw: string | null): DepartmentTaskSelection {
  const empty: DepartmentTaskSelection = {
    checkedTemplateItemIds: [],
    checkedSubItemIds: [],
    customTasks: [],
    contactManagerId: null,
    leadUserId: null,
    teamMemberIds: [],
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
    leadUserId?: unknown;
    teamMemberIds?: unknown;
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

  const leadUserId =
    typeof obj.leadUserId === "string" && obj.leadUserId.trim() ? obj.leadUserId.trim() : null;

  const teamMemberIds = Array.isArray(obj.teamMemberIds)
    ? obj.teamMemberIds.filter((v): v is string => typeof v === "string")
    : [];

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

  return {
    checkedTemplateItemIds,
    checkedSubItemIds,
    customTasks,
    contactManagerId,
    leadUserId,
    teamMemberIds,
    taskAssignments,
  };
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

  // ГИП необязателен при создании, можно сразу несколько (2026-08-06, по
  // прямой просьбе: "ГИП-ов может быть несколько на один проект") —
  // назначить/добавить ещё можно и позже через assignGipAction на странице
  // проекта. formData.getAll — тот же приём, что и у departmentIds
  // (new-project-dialog.tsx рендерит по одному hidden input на каждого
  // выбранного).
  const gipUserIds = Array.from(
    new Set((formData.getAll("gipUserId") as string[]).map((v) => v.trim()).filter(Boolean)),
  );

  // Нужны email/имя для уведомлений — заодно валидируем, что все выбранные
  // ГИП реально существуют (иначе ниже упадёт по FK).
  const gipUsers = gipUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: gipUserIds } },
        select: { id: true, email: true, fullName: true },
      })
    : [];
  if (gipUsers.length !== gipUserIds.length) {
    throw new Error("Один из выбранных ГИП не найден");
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
                weight: true,
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
    // Весовой прогресс раздела (см. lib/tasks/progress.ts) — унаследован от
    // DepartmentTaskTemplateItem.weight для пунктов стека, 1 (равный вес)
    // для произвольных задач, которых нет в стеке.
    weight: number;
  };

  function buildTaskPlan(
    key: string,
    title: string,
    description: string | null,
    assignment: TaskAssignmentInput | undefined,
    employeeIds: Set<string>,
    checklistTitles: string[] = [],
    weight = 1,
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
      weight,
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
            item.weight,
          ),
        );
      }
    }
    for (const custom of selection.customTasks) {
      tasks.push(
        buildTaskPlan(custom.key, custom.title, null, selection.taskAssignments[custom.key], employeeIds),
      );
    }

    // Лид/команда (шаг "Команда") — та же серверная проверка, что и у
    // исполнителя задачи: клиентский пикер уже ограничивает выбор
    // сотрудниками ЭТОГО департамента, но это не замена проверке на сервере.
    if (selection.leadUserId && !employeeIds.has(selection.leadUserId)) {
      throw new Error("Лид проекта должен быть сотрудником выбранного департамента");
    }
    const teamMemberIds = selection.teamMemberIds.filter((id) => employeeIds.has(id));

    return {
      departmentId: department.id,
      name: department.name,
      contactManagerId: selection.contactManagerId,
      leadUserId: selection.leadUserId,
      teamMemberIds,
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

  const creatorIsGip = gipUserIds.includes(session.user.id);

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

    const gipMembers = await Promise.all(
      gipUserIds.map((gipUserId) =>
        tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: gipUserId,
            projectRole: ProjectRole.ГИП,
          },
        }),
      ),
    );
    for (const gipUserId of gipUserIds) {
      await notifyGipAssigned(tx, { userId: gipUserId, actorId: session.user.id, projectName: name });
    }
    // Если создатель сам среди выбранных ГИП — его собственное членство в
    // проекте это уже созданная выше ГИП-запись, отдельную МЕНЕДЖЕР-запись
    // заводить не нужно (иначе получится дубль по @@unique([projectId, userId])).
    const creatorGipMember = gipMembers.find((m) => m.userId === session.user.id) ?? null;

    const creatorMember =
      creatorIsGip && creatorGipMember
        ? creatorGipMember
        : await tx.projectMember.create({
            data: {
              projectId: project.id,
              userId: session.user.id,
              projectRole: ProjectRole.МЕНЕДЖЕР,
            },
          });

    // Шаг "Команда" + шаг 5: Лид/команда/исполнители — все должны стать
    // участниками проекта (см. план, D8, и добавление Лида/команды
    // 2026-07-30). Роль применяется только при РЕАЛЬНОМ создании — если
    // человек уже участник (например, сам ГИП или создатель), его роль не
    // понижаем и не переопределяем на ИНЖЕНЕР (см. ensureProjectMember).
    // Лид получает ВЕДУЩИЙ_СПЕЦИАЛИСТ первым, чтобы не потерять эту роль,
    // если тот же человек попал ещё и в teamMemberIds/distinctAssigneeUserIds.
    const memberRoleByUserId = new Map<string, ProjectRole>();
    for (const plan of sectionPlans) {
      if (plan.leadUserId) {
        memberRoleByUserId.set(plan.leadUserId, ProjectRole.ВЕДУЩИЙ_СПЕЦИАЛИСТ);
      }
    }
    for (const plan of sectionPlans) {
      for (const teamUserId of plan.teamMemberIds) {
        if (!memberRoleByUserId.has(teamUserId)) {
          memberRoleByUserId.set(teamUserId, ProjectRole.ИНЖЕНЕР);
        }
      }
    }
    for (const userId of distinctAssigneeUserIds) {
      if (!memberRoleByUserId.has(userId)) {
        memberRoleByUserId.set(userId, ProjectRole.ИНЖЕНЕР);
      }
    }

    const memberIdByUserId = new Map<string, string>();
    for (const [userId, role] of memberRoleByUserId) {
      const { member } = await ensureProjectMember(tx, {
        projectId: project.id,
        userId,
        role,
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
            weight: taskPlan.weight,
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
  for (const gipUser of gipUsers) {
    sendGipAssignedEmail({
      to: gipUser.email,
      employeeName: gipUser.fullName,
      projectName: name,
      assignedByName: session.user.name ?? "Руководитель",
    }).catch((error) => {
      console.error("Не удалось отправить уведомление о назначении ГИП", error);
    });
  }

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
    gipName: gipUsers.length > 0 ? gipUsers.map((u) => u.fullName).join(", ") : null,
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

// Назначить ГИП можно и после создания проекта (изначально это было только
// в мастере создания). На проекте может быть НЕСКОЛЬКО ГИП одновременно
// (2026-08-06, по прямой просьбе) — раньше эта функция понижала
// предыдущего ГИП до МЕНЕДЖЕРа при назначении нового, из-за чего второй
// ГИП физически не мог появиться; теперь она только ДОБАВЛЯЕТ нового,
// никого не трогая. Снять ГИП с кого-то конкретного — отдельная
// removeGipAction ниже (уже существовала для чеклиста на профиле
// сотрудника, теперь это и есть единственный способ убрать ГИП).
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
    const existingMembership = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: gipUserId } },
    });

    if (existingMembership?.projectRole === ProjectRole.ГИП) {
      return false;
    }

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
    const allGips = await prisma.projectMember.findMany({
      where: { projectId, projectRole: ProjectRole.ГИП },
      select: { user: { select: { fullName: true } } },
    });
    syncProjectField(projectId, "gip", allGips.map((m) => m.user.fullName).join(", ")).catch((error) => {
      console.error("Не удалось обновить ГИП проекта в Google Sheets", error);
    });
  }

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

// Снять ГИП с проекта БЕЗ замены на кого-то другого — для чеклиста
// "Проекты, где ГИП" на странице сотрудника (см. gip-projects-checklist.tsx):
// там можно снять галочку с проекта, не выбирая никого взамен. Не удаляет
// членство в проекте — понижает роль до МЕНЕДЖЕР, как и при обычной смене
// ГИП в assignGipAction выше (человек остаётся участником проекта).
export async function removeGipAction(projectId: string, userId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const managesThisProject = await userManagesDepartmentInProject(session.user, projectId);
  if (!canManageOperations(session.user, managesThisProject)) {
    throw new Error("Снимать ГИП может только руководитель");
  }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId, projectRole: ProjectRole.ГИП },
  });
  if (!member) {
    return;
  }

  await prisma.projectMember.update({
    where: { id: member.id },
    data: { projectRole: ProjectRole.МЕНЕДЖЕР },
  });

  const remainingGips = await prisma.projectMember.findMany({
    where: { projectId, projectRole: ProjectRole.ГИП },
    select: { user: { select: { fullName: true } } },
  });
  syncProjectField(projectId, "gip", remainingGips.map((m) => m.user.fullName).join(", ")).catch(
    (error) => {
      console.error("Не удалось обновить ГИП проекта в Google Sheets", error);
    },
  );

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

// Обратимая альтернатива удалению (Task 1.2, PRD #3 Phase 2) — та же
// аудитория, что раньше могла удалять проект (администратор или
// руководитель ЭТОГО проекта), но здесь можно и отменить. Данные проекта
// не трогаем — просто скрываем из основного списка (см. lib/projects/queries.ts).
export async function archiveProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const managesThisProject = await userManagesDepartmentInProject(session.user, projectId);
  if (!canManageOperations(session.user, managesThisProject)) {
    throw new Error("Архивировать проект может только руководитель");
  }

  await prisma.project.update({ where: { id: projectId }, data: { isArchived: true } });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

export async function unarchiveProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  const managesThisProject = await userManagesDepartmentInProject(session.user, projectId);
  if (!canManageOperations(session.user, managesThisProject)) {
    throw new Error("Восстановить проект может только руководитель");
  }

  await prisma.project.update({ where: { id: projectId }, data: { isArchived: false } });

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
//
// Task 1.2 (PRD #3 Phase 2): раньше это мог и руководитель департамента
// проекта — теперь ТОЛЬКО администратор. Обычное "закрыть/убрать проект" —
// это архивирование (см. archiveProjectAction выше), жёсткое удаление —
// редкое, необратимое действие, поэтому уже администратор + аудит-лог.
export async function deleteProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  if (!isFullAdmin(session.user.systemRole)) {
    throw new Error("Удалять проект безвозвратно может только администратор");
  }

  // Файлы в Blob удаляются best-effort уже после коммита транзакции (см.
  // конец функции) — сначала собираем их URL, пока строки Document ещё
  // не удалены.
  const attachments = await prisma.document.findMany({
    where: { OR: [{ section: { projectId } }, { task: { section: { projectId } } }] },
    select: { fileUrl: true },
  });

  await prisma.$transaction(async (tx) => {
    await recordAuditLog(tx, {
      actorId: session.user.id,
      action: "hard_delete",
      targetType: "Project",
      targetId: projectId,
      isOverride: true,
    });

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
      department: { select: { managers: { select: { id: true } } } },
    },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }

  const managesThisSection = !!section.department?.managers.some((m) => m.id === session.user.id);
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
//
// По прямой просьбе Камилы (2026-07-30): менять срок теперь может и Лид
// ЭТОГО департамента, не только руководитель. Каждое изменение deadline
// пишется в SectionDeadlineChange — reasonCategory обязателен, только
// если это реально ПРОДЛЕНИЕ (новый срок позже старого, а старый уже был
// задан); первичная простановка срока или перенос раньше категории не
// требуют. Категория (см. lib/projects/shift-reasons.ts) — из прототипа
// ProjecTeam департамента Архитектуры: делит причины на внешние/внутренние
// для аналитики "сколько сдвигов по вине Заказчика".
export async function updateSectionDatesAction(
  sectionId: string,
  startDate: string | null,
  deadline: string | null,
  reasonCategory?: ShiftReasonCategory | null,
  comment?: string,
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      projectId: true,
      deadline: true,
      baselineStartDate: true,
      baselineDeadline: true,
      department: { select: { id: true, managers: { select: { id: true } } } },
    },
  });
  if (!section) {
    throw new Error("Раздел не найден");
  }

  const managesThisSection = !!section.department?.managers.some((m) => m.id === session.user.id);
  const isManager = canManageOperations(session.user, managesThisSection);
  const isLeadOfDept =
    !isManager && section.department
      ? await isLeadOfDepartment(session.user.id, section.department.id)
      : false;
  if (!isManager && !isLeadOfDept) {
    throw new Error("Менять сроки раздела может только руководитель или Лид этого департамента");
  }

  const newStartDate = startDate ? new Date(startDate) : null;
  const newDeadline = deadline ? new Date(deadline) : null;
  const deadlineChanged = (section.deadline?.getTime() ?? null) !== (newDeadline?.getTime() ?? null);
  const isExtension = Boolean(section.deadline && newDeadline && newDeadline.getTime() > section.deadline.getTime());
  if (isExtension && !reasonCategory) {
    throw new Error("Укажите причину продления срока");
  }
  const trimmedComment = comment?.trim() || null;

  // Гант (Phase 3, 2026-07-30) — базовый срок замораживается ПЕРВЫМ
  // когда-либо заданным значением и больше никогда не трогается здесь же,
  // независимо для старта и дедлайна (можно задать старт раньше дедлайна).
  const baselineStartDate = section.baselineStartDate ?? newStartDate;
  const baselineDeadline = section.baselineDeadline ?? newDeadline;

  await prisma.$transaction(async (tx) => {
    await tx.section.update({
      where: { id: sectionId },
      data: {
        startDate: newStartDate,
        deadline: newDeadline,
        baselineStartDate,
        baselineDeadline,
      },
    });

    if (deadlineChanged) {
      await tx.sectionDeadlineChange.create({
        data: {
          sectionId,
          previousDeadline: section.deadline,
          newDeadline,
          reasonCategory: reasonCategory ?? null,
          comment: trimmedComment,
          changedByUserId: session.user.id,
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath(`/projects/${section.projectId}`);
}

// Обёртка над чтением истории продлений как Server Action — вызывается по
// клику из клиентского компонента (попап истории), а не как обычные
// данные страницы, поэтому не в lib/projects/queries.ts напрямую.
// Доступ — любой авторизованный (та же лёгкая видимость, что и у самой
// страницы проекта, см. project detail page.tsx).
export async function getSectionDeadlineHistoryAction(sectionId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }
  return getSectionDeadlineHistory(sectionId);
}
