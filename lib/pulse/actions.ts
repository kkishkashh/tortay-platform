"use server";

import { revalidatePath } from "next/cache";
import { PulseSignal } from "@prisma/client";

import { auth } from "@/auth";
import { isLeadOfDepartment } from "@/lib/leads/queries";
import { prisma } from "@/lib/prisma";
import { currentIsoWeek } from "@/lib/pulse/week";

// Проставить/обновить пульс раздела за ТЕКУЩУЮ неделю — ТОЛЬКО руководитель
// ИЛИ Лид именно этого департамента. По прямой просьбе Камилы (2026-07-30)
// без обычного админ/бухгалтер-обхода (в отличие от updateSectionDatesAction)
// — "Пульс недели" видна и управляется строго теми, кто реально состоит в
// Архитектуре; если админу это нужно, пусть добавит себя в департамент.
// Upsert по @@unique([sectionId, isoWeek]) — повторная отметка на той же
// неделе просто обновляет запись.
export async function setPulseAction(sectionId: string, signal: PulseSignal, note?: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Не авторизован");
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      projectId: true,
      department: {
        select: {
          id: true,
          managers: { select: { id: true } },
          usesPulseTracking: true,
        },
      },
    },
  });
  if (!section || !section.department) {
    throw new Error("Раздел не найден");
  }
  if (!section.department.usesPulseTracking) {
    throw new Error("У этого департамента не включён Пульс недели");
  }

  const isManager = section.department.managers.some((manager) => manager.id === session.user.id);
  const isLeadOfDept = !isManager && (await isLeadOfDepartment(session.user.id, section.department.id));
  if (!isManager && !isLeadOfDept) {
    throw new Error("Проставлять пульс может только руководитель или Лид этого департамента");
  }

  const isoWeek = currentIsoWeek();
  const trimmedNote = note?.trim() || null;

  await prisma.sectionPulse.upsert({
    where: { sectionId_isoWeek: { sectionId, isoWeek } },
    create: { sectionId, isoWeek, signal, note: trimmedNote, authorId: session.user.id },
    update: { signal, note: trimmedNote, authorId: session.user.id },
  });

  revalidatePath("/pulse");
  revalidatePath(`/projects/${section.projectId}`);
}
