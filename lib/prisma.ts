import { PrismaClient } from "@prisma/client";

// В dev-режиме Next.js пересоздаёт модули при каждом hot-reload —
// без этого глобального кеша каждый reload плодил бы новое подключение к БД.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
