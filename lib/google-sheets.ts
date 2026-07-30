import { JWT } from "google-auth-library";

// Тот же принцип толерантности, что и у GMAIL_*/BLOB_* (см. lib/email/send.ts):
// если сервисный аккаунт не настроен, просто предупреждаем в консоль и
// пропускаем экспорт, а не роняем создание/редактирование проекта.
const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? null;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;
// В .env ключ хранится с буквальными "\n" (как в скачанном JSON), а не
// настоящими переводами строк — распаковываем перед использованием.
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? null;

const client =
  SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY
    ? new JWT({
        email: SERVICE_ACCOUNT_EMAIL,
        key: PRIVATE_KEY,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
    : null;

// Таблица — подстраховка на случай недоступности сайта (см. обсуждение с
// Камилой): строки НИКОГДА не удаляются и не очищаются этим модулем, даже
// когда сам проект удаляют в приложении (см. deleteProjectAction — там
// сознательно нет вызова в этот файл). Последний столбец — техническое
// id проекта, не для чтения человеком, но нужен, чтобы находить нужную
// строку при последующих правках (имя/ГИП/статус) без дублирования строк.
const HEADER_ROW = [
  "Дата создания",
  "Название проекта",
  "Заказчик",
  "Локация",
  "Дата начала",
  "Дата окончания",
  "Описание",
  "ГИП",
  "Создал",
  "Статус",
  "ID проекта",
];
const ID_COLUMN_LETTER = "K";
const FIELD_COLUMN_LETTER = { name: "B", gip: "H", status: "J" } as const;

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("ru-RU") : "";
}

function columnRange(sheetTitle: string, columnLetter: string, row?: number) {
  return row ? `${sheetTitle}!${columnLetter}${row}` : `${sheetTitle}!${columnLetter}:${columnLetter}`;
}

// Название первого листа не всегда "Sheet1" — у аккаунтов с русской/казахской
// локалью Google Sheets по умолчанию называет его "Лист1" и т.п., поэтому
// нельзя захардкодить имя листа: спрашиваем его у самой таблицы.
let cachedFirstSheetTitle: string | null = null;
async function getFirstSheetTitle(): Promise<string> {
  if (cachedFirstSheetTitle) return cachedFirstSheetTitle;
  const res = await client!.request<{ sheets: { properties: { title: string; index: number } }[] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
  });
  const first = res.data.sheets.find((s) => s.properties.index === 0) ?? res.data.sheets[0];
  cachedFirstSheetTitle = first.properties.title;
  return cachedFirstSheetTitle;
}

async function ensureHeaderRow(sheetTitle: string) {
  const range = `${sheetTitle}!A1:K1`;
  const readRes = await client!.request<{ values?: string[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`,
  });
  const existing = readRes.data.values?.[0] ?? [];
  // Заголовок — не пользовательские данные, а фиксированные подписи
  // столбцов, так что дописать/перезаписать его безопасно (в отличие от
  // строк с проектами). Пропускаем перезапись, только если он уже полный —
  // иначе, например, добавленные позже столбцы "Статус"/"ID проекта" так и
  // останутся без подписи (см. историю этого бага).
  if (existing.length >= HEADER_ROW.length) return;

  await client!.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    method: "PUT",
    data: { values: [HEADER_ROW] },
  });
}

// 1-индексированный номер строки в таблице по id проекта в столбце K,
// либо null, если строки ещё нет (проект появился до этой фичи и его ещё
// не добавили через syncNewProjectRow/бэкофилл-скрипт).
async function findRowNumberByProjectId(sheetTitle: string, projectId: string): Promise<number | null> {
  const res = await client!.request<{ values?: string[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(columnRange(sheetTitle, ID_COLUMN_LETTER))}`,
  });
  const values = res.data.values ?? [];
  const index = values.findIndex((row) => row[0] === projectId);
  return index === -1 ? null : index + 1;
}

export type SheetProjectRow = {
  id: string;
  name: string;
  client: string | null;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  description: string | null;
  gipName: string | null;
  createdByName: string;
  statusLabel: string;
  createdAt: Date;
};

function buildRow(project: SheetProjectRow): string[] {
  return [
    formatDate(project.createdAt),
    project.name,
    project.client ?? "",
    project.location ?? "",
    formatDate(project.startDate),
    formatDate(project.endDate),
    project.description ?? "",
    project.gipName ?? "",
    project.createdByName,
    project.statusLabel,
    project.id,
  ];
}

// Добавляет новую строку — вызывается при создании проекта, а также
// бэкофилл-скриптом (prisma/scripts/backfill-google-sheets.ts) для
// проектов, созданных до появления этой фичи.
export async function appendProjectRow(project: SheetProjectRow) {
  if (!client || !SHEET_ID) {
    console.warn(
      `[google-sheets] GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY/GOOGLE_SHEET_ID не заданы — проект «${project.name}» не экспортирован в таблицу`,
    );
    return;
  }

  const sheetTitle = await getFirstSheetTitle();
  await ensureHeaderRow(sheetTitle);

  const appendRange = `${sheetTitle}!A:K`;
  await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED`,
    method: "POST",
    data: { values: [buildRow(project)] },
  });
}

// Обновляет одно поле в уже существующей строке проекта (по id), не трогая
// остальные ячейки — вызывается после переименования, смены ГИП или смены
// статуса. Если строки для этого проекта ещё нет (см. комментарий у
// findRowNumberByProjectId), молча пропускает и предупреждает в консоль:
// без полного набора данных проекта (заказчик/локация/даты и т.п.) здесь
// не из чего собрать новую строку — такие проекты подхватит бэкофилл-скрипт.
export async function syncProjectField(
  projectId: string,
  field: keyof typeof FIELD_COLUMN_LETTER,
  value: string,
) {
  if (!client || !SHEET_ID) {
    console.warn(
      `[google-sheets] GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY/GOOGLE_SHEET_ID не заданы — изменение поля "${field}" проекта ${projectId} не отражено в таблице`,
    );
    return;
  }

  const sheetTitle = await getFirstSheetTitle();
  // Из-за задержки согласованности Google Sheets API строка, только что
  // добавленная append'ом при создании проекта, иногда ещё не видна
  // немедленному следующему values.get (например, если проект переименовали
  // сразу после создания) — несколько попыток с паузой покрывают этот
  // случай, не наказывая обычные правки, где строка находится с первого раза.
  let rowNumber: number | null = null;
  for (let attempt = 0; attempt < 3 && rowNumber === null; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
    rowNumber = await findRowNumberByProjectId(sheetTitle, projectId);
  }
  if (rowNumber === null) {
    console.warn(
      `[google-sheets] строка проекта ${projectId} не найдена в таблице — изменение поля "${field}" не отражено (проект появится в таблице после следующего запуска бэкофилл-скрипта)`,
    );
    return;
  }

  const columnLetter = FIELD_COLUMN_LETTER[field];
  await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(columnRange(sheetTitle, columnLetter, rowNumber))}?valueInputOption=USER_ENTERED`,
    method: "PUT",
    data: { values: [[value]] },
  });
}

// Для бэкофилл-скрипта: читает уже существующие строки (название в столбце
// B, id в столбце K), чтобы решить, для каких проектов из БД строка уже
// есть (по id), для каких есть "осиротевшая" строка без id (проекты,
// созданные до появления этой фичи — их нужно только дозаполнить, а не
// дублировать), а для каких строки нет вообще.
export async function getExistingSheetRows(): Promise<{ rowNumber: number; name: string; id: string }[]> {
  if (!client || !SHEET_ID) return [];
  const sheetTitle = await getFirstSheetTitle();
  await ensureHeaderRow(sheetTitle);

  const res = await client.request<{ values?: string[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`${sheetTitle}!B2:K`)}`,
  });
  const values = res.data.values ?? [];
  return values.map((row, index) => ({
    rowNumber: index + 2,
    name: row[0] ?? "",
    id: row[9] ?? "",
  }));
}

// Дозаполняет id и статус в "осиротевшей" строке (созданной до появления
// этой фичи, найденной по совпадению названия) — остальные ячейки, уже
// заполненные при первом экспорте, не трогает.
export async function fillLegacyRowIdentity(rowNumber: number, projectId: string, statusLabel: string) {
  if (!client || !SHEET_ID) return;
  const sheetTitle = await getFirstSheetTitle();
  await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`${sheetTitle}!J${rowNumber}:K${rowNumber}`)}?valueInputOption=USER_ENTERED`,
    method: "PUT",
    data: { values: [[statusLabel, projectId]] },
  });
}
