import { ProjectStatus, SectionStatus } from "@prisma/client";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.В_РАБОТЕ]: "В работе",
  [ProjectStatus.ЗАВЕРШЁН_ПО_РАЗДЕЛАМ]: "Завершён по разделам",
  [ProjectStatus.ЗАВЕРШЁН_ПОЛНОСТЬЮ]: "Завершён полностью",
};

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  [SectionStatus.В_РАБОТЕ]: "В работе",
  [SectionStatus.ВЫПОЛНЕНО]: "Выполнено",
};
