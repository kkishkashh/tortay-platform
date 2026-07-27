import { JWT } from "google-auth-library";

// Тот же принцип толерантности, что и у GMAIL_*/BLOB_* (см. lib/email/send.ts):
// если сервисный аккаунт не настроен, просто предупреждаем в консоль и
// пропускаем экспорт, а не роняем создание проекта.
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
];

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("ru-RU") : "";
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
  const range = `${sheetTitle}!A1:I1`;
  const readRes = await client!.request<{ values?: string[][] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`,
  });
  if (readRes.data.values && readRes.data.values.length > 0) return;

  await client!.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    method: "PUT",
    data: { values: [HEADER_ROW] },
  });
}

export async function appendProjectToSheet(project: {
  name: string;
  client: string | null;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  description: string | null;
  gipName: string;
  createdByName: string;
}) {
  if (!client || !SHEET_ID) {
    console.warn(
      `[google-sheets] GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY/GOOGLE_SHEET_ID не заданы — проект «${project.name}» не экспортирован в таблицу`,
    );
    return;
  }

  const sheetTitle = await getFirstSheetTitle();
  await ensureHeaderRow(sheetTitle);

  const row = [
    formatDate(new Date()),
    project.name,
    project.client ?? "",
    project.location ?? "",
    formatDate(project.startDate),
    formatDate(project.endDate),
    project.description ?? "",
    project.gipName,
    project.createdByName,
  ];

  const appendRange = `${sheetTitle}!A:I`;
  await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED`,
    method: "POST",
    data: { values: [row] },
  });
}
