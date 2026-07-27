// Одноразовый скрипт: заносит в подстраховочную Google-таблицу все
// проекты, созданные ДО появления автоэкспорта (см. lib/google-sheets.ts,
// createProjectAction). Запускать один раз сейчас, и заново — если таблицу
// пересоздали или подключили новый Google-аккаунт:
//
//   npx tsx prisma/scripts/backfill-google-sheets.ts
//
// Идемпотентен и строго additive — никогда не удаляет и не перезаписывает
// уже заполненные ячейки:
//   - проект уже есть в таблице (найден по id в столбце K) → пропускаем;
//   - есть "осиротевшая" строка без id, но с совпадающим названием (создана
//     до появления столбцов "Статус"/"ID проекта") → дозаполняем только эти
//     две ячейки, остальное не трогаем;
//   - иначе — строки нет вовсе → добавляем новую в конец.
import { PrismaClient, ProjectRole } from "@prisma/client";

import { PROJECT_STATUS_LABELS } from "../../lib/projects/status-labels";
import { appendProjectRow, fillLegacyRowIdentity, getExistingSheetRows } from "../../lib/google-sheets";

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      client: true,
      location: true,
      startDate: true,
      endDate: true,
      description: true,
      status: true,
      createdAt: true,
      members: {
        where: { projectRole: ProjectRole.ГИП },
        select: { user: { select: { fullName: true } } },
        take: 1,
      },
    },
  });

  const existingRows = await getExistingSheetRows();
  const rowIdsPresent = new Set(existingRows.filter((r) => r.id).map((r) => r.id));
  const legacyRowByName = new Map(existingRows.filter((r) => !r.id).map((r) => [r.name, r.rowNumber]));

  let skipped = 0;
  let filled = 0;
  let appended = 0;

  for (const project of projects) {
    if (rowIdsPresent.has(project.id)) {
      skipped++;
      continue;
    }

    const statusLabel = PROJECT_STATUS_LABELS[project.status];
    const legacyRowNumber = legacyRowByName.get(project.name);

    if (legacyRowNumber) {
      await fillLegacyRowIdentity(legacyRowNumber, project.id, statusLabel);
      console.log(`Дозаполнена строка ${legacyRowNumber}: «${project.name}»`);
      filled++;
      continue;
    }

    await appendProjectRow({
      id: project.id,
      name: project.name,
      client: project.client,
      location: project.location,
      startDate: project.startDate,
      endDate: project.endDate,
      description: project.description,
      gipName: project.members[0]?.user.fullName ?? "—",
      createdByName: "—", // не отслеживалось в БД до появления этой фичи
      statusLabel,
      createdAt: project.createdAt,
    });
    console.log(`Добавлена новая строка: «${project.name}»`);
    appended++;
  }

  console.log(`\nГотово. Уже было: ${skipped}. Дозаполнено: ${filled}. Добавлено новых строк: ${appended}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
