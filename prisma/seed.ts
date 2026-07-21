import { PrismaClient, SystemRole, UserType } from "@prisma/client";
import bcrypt from "bcryptjs";

import { DEPARTMENT_SEED_DATA } from "./department-seed-data";

const prisma = new PrismaClient();

// Примеры пунктов базового стека задач по каждому департаменту — для
// свежей БД (npm run dev на чистом клоне), чтобы сразу было видно, как
// работает создание проекта с чекбоксами. Для АР — прямой перевод примера
// из брифа (Master Plan/Floor Plans/Facades/...). Список НЕ хардкод в
// смысле приложения — это просто содержимое одноразового сида, admin
// свободно редактирует/удаляет эти пункты через интерфейс департамента.
const SAMPLE_TASK_STACK: Record<string, string[]> = {
  AR: [
    "Мастер-план",
    "Планы этажей",
    "Фасады",
    "Разрезы",
    "Узлы и детали",
    "BIM-модель",
    "Документация",
  ],
  KJ: ["Расчётная схема", "Фундаменты", "Каркас здания", "Узлы соединений", "Спецификация арматуры"],
  VK: ["Схема водоснабжения", "Схема канализации", "Спецификация оборудования"],
  OV: ["Тепловой расчёт", "Схема отопления", "Схема вентиляции"],
  EOM: ["Однолинейная схема", "Расчёт нагрузок", "План освещения"],
  SS: ["Структурированные кабельные сети", "Видеонаблюдение", "Пожарная сигнализация"],
  PB: ["Пути эвакуации", "Автоматическая пожарная сигнализация", "Расчёт пожарных рисков"],
  SMR: ["Локальная смета", "Объектная смета", "Сводный сметный расчёт"],
};

async function main() {
  const passwordHash = await bcrypt.hash("kama@0507", 10);

  const user = await prisma.user.upsert({
    where: { email: "kamilatleugali7@gmail.com" },
    update: {},
    create: {
      email: "kamilatleugali7@gmail.com",
      fullName: "Камила Тлеугали",
      passwordHash,
      systemRole: SystemRole.РУКОВОДИТЕЛЬ,
      userType: UserType.ШТАТНЫЙ,
    },
  });

  console.log("Создан пользователь:", user.email, user.systemRole);

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
    console.log("Департамент готов:", department.code, department.name);

    // Идемпотентно: если в департаменте уже есть хоть один пункт (в т.ч.
    // добавленный вручную через интерфейс), сид его не трогает — не
    // хотим затирать реальные правки повторным запуском.
    const existingItemsCount = await prisma.departmentTaskTemplateItem.count({
      where: { departmentId: department.id },
    });
    const sampleTitles = SAMPLE_TASK_STACK[seed.code] ?? [];
    if (existingItemsCount === 0 && sampleTitles.length > 0) {
      await prisma.departmentTaskTemplateItem.createMany({
        data: sampleTitles.map((title, itemIndex) => ({
          departmentId: department.id,
          title,
          orderIndex: itemIndex,
        })),
      });
      console.log(`  добавлено пунктов базового стека: ${sampleTitles.length}`);
    }
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
