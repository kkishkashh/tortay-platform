import { formatThousandsRu, numberToWordsRu, pluralFormRu } from "@/lib/utils/number-to-words-ru";

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// «27» июля 2026 г. — формат даты, принятый в тексте договора (см. образец).
export function formatContractDate(date: Date): string {
  return `«${date.getDate()}» ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} г.`;
}

// "400 000 (четыреста тысяч) тенге" — сумма всегда дублируется цифрами и
// прописью в договорах, чтобы исключить разночтения.
export function formatMoneyPhrase(amount: number): string {
  return `${formatThousandsRu(amount)} (${numberToWordsRu(amount)}) тенге`;
}

// "14 (четырнадцать) календарных дней" — прилагательное "календарный"
// склоняется только между ед.ч. ("календарный день") и всеми остальными
// случаями ("календарных дня/дней") — родительный мн.ч. прилагательного
// используется и для "мало" (2-4), и для "много" (5+), в отличие от
// самого существительного, которое различает эти два случая.
export function formatDaysPhrase(days: number): string {
  const noun = pluralFormRu(days, ["день", "дня", "дней"]);
  const adjective = noun === "день" ? "календарный" : "календарных";
  return `${days} (${numberToWordsRu(days)}) ${adjective} ${noun}`;
}

// "Максимов Пётр Александрович" → "Максимов П.А." — для строки подписи
// (см. образец: "Директор___________ Максимов П.А."). Рассчитано на
// стандартные ФИО из 2-3 слов; если формат нестандартный, просто вернёт
// исходную строку без сокращения, а не упадёт.
export function abbreviateFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  const [lastName, firstName, patronymic] = parts;
  let result = lastName;
  if (firstName) result += ` ${firstName[0]}.`;
  if (patronymic) result += `${patronymic[0]}.`;
  return result;
}
