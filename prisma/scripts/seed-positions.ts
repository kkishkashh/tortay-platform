// Одноразовый скрипт: переносит захардкоженный список COMMON_POSITIONS
// в новую таблицу Position (см. миграцию add_positions). Запускать один раз:
//
//   npx tsx prisma/scripts/seed-positions.ts
//
// Идемпотентен — upsert по уникальному name, повторный запуск безопасен.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Типовые должности инженерной компании — бывший захардкоженный список
// COMMON_POSITIONS (см. lib/employees/positions.ts до этой миграции).
const INITIAL_POSITIONS = [
  "Главный инженер проекта",
  "Архитектор",
  "Инженер-конструктор",
  "Инженер ВК",
  "Инженер ОВК",
  "Инженер-электрик",
  "Менеджер проектов",
  "Помощник ГИПа",
];

async function main() {
  for (const name of INITIAL_POSITIONS) {
    await prisma.position.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`Должность готова: ${name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
