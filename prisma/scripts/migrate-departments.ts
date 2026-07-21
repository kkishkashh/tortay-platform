// Одноразовый скрипт: заводит 8 стартовых департаментов и переносит
// существующие Section на них по совпадению префикса названия. Запускать
// один раз после накатки миграции add_departments:
//
//   npx tsx prisma/scripts/migrate-departments.ts
//
// Идемпотентен: department upsert по code, а Section обновляются только те,
// у которых departmentId ещё NULL — повторный запуск безопасен.
import { PrismaClient } from "@prisma/client";

import {
  DEPARTMENT_SEED_DATA,
  LEGACY_SECTION_PREFIX_TO_DEPARTMENT_CODE,
} from "../department-seed-data";

const prisma = new PrismaClient();

async function main() {
  const departmentIdByCode = new Map<string, string>();

  for (const [index, seed] of DEPARTMENT_SEED_DATA.entries()) {
    const department = await prisma.department.upsert({
      where: { code: seed.code },
      update: {},
      create: {
        code: seed.code,
        name: seed.name,
        color: seed.color,
        icon: seed.icon,
        orderIndex: index,
      },
    });
    departmentIdByCode.set(seed.code, department.id);
    console.log(`Департамент готов: ${seed.code} — ${department.name} (${department.id})`);
  }

  let totalBackfilled = 0;
  for (const [prefix, code] of Object.entries(LEGACY_SECTION_PREFIX_TO_DEPARTMENT_CODE)) {
    const departmentId = departmentIdByCode.get(code);
    if (!departmentId) continue;

    const result = await prisma.section.updateMany({
      where: { departmentId: null, name: { startsWith: prefix } },
      data: { departmentId },
    });
    if (result.count > 0) {
      console.log(`Привязано разделов "${prefix}*" → ${code}: ${result.count}`);
    }
    totalBackfilled += result.count;
  }

  const stillUnassigned = await prisma.section.count({ where: { departmentId: null } });
  console.log(`\nВсего привязано: ${totalBackfilled}. Без департамента осталось: ${stillUnassigned} (ожидаемо для ПЗ/ГП/ТХ/ИОС и произвольных названий).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
