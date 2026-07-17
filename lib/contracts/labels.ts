import { AvrStage, ContractStatus, PaymentStatus, PaymentType } from "@prisma/client";

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.ЧЕРНОВИК]: "Черновик",
  [ContractStatus.НА_ПРОВЕРКЕ_ГИП]: "На проверке ГИП",
  [ContractStatus.СОГЛАСОВАН]: "Согласован",
  [ContractStatus.ПОДПИСАН]: "Подписан",
  [ContractStatus.ЗАКРЫТ]: "Закрыт",
  [ContractStatus.ОТМЕНЁН]: "Отменён",
};

// Цвета — из зарезервированной статусной палитры (см. workload.ts), плюс
// фирменный золотой для "в процессе движения вперёд" (Согласован/Стадия 2).
export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  [ContractStatus.ЧЕРНОВИК]: "#c3c2b7",
  [ContractStatus.НА_ПРОВЕРКЕ_ГИП]: "#fab219",
  [ContractStatus.СОГЛАСОВАН]: "var(--primary)",
  [ContractStatus.ПОДПИСАН]: "#0ca30c",
  [ContractStatus.ЗАКРЫТ]: "#c3c2b7",
  [ContractStatus.ОТМЕНЁН]: "#d03b3b",
};

export const AVR_STAGE_LABELS: Record<AvrStage, string> = {
  [AvrStage.НЕТ]: "Нет",
  [AvrStage.СТАДИЯ_1]: "Стадия 1",
  [AvrStage.СТАДИЯ_2]: "Стадия 2",
  [AvrStage.ФИНАЛЬНАЯ]: "Финальная",
};

export const AVR_STAGE_COLORS: Record<AvrStage, string> = {
  [AvrStage.НЕТ]: "#c3c2b7",
  [AvrStage.СТАДИЯ_1]: "#fab219",
  [AvrStage.СТАДИЯ_2]: "var(--primary)",
  [AvrStage.ФИНАЛЬНАЯ]: "#0ca30c",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  [PaymentType.АВАНС]: "Аванс",
  [PaymentType.ТРАНШ_2]: "2-й транш",
  [PaymentType.ТРАНШ_3]: "3-й транш",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.ОЖИДАЕТСЯ]: "Ожидается",
  [PaymentStatus.ОПЛАЧЕНО]: "Оплачено",
};
