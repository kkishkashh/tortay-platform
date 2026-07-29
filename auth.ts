import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT вместо хранения сессий в БД: сессия целиком лежит в подписанном
  // cookie, поэтому не нужны служебные таблицы Account/Session (см. бриф).
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const emailRaw = credentials.email as string | undefined;
        const password = credentials.password as string | undefined;

        if (!emailRaw || !password) {
          return null;
        }

        // Email хранится в нижнем регистре (см. createEmployeeAction/seed.ts) —
        // здесь та же нормализация, иначе вход не найдёт совпадение при
        // разнице в регистре (например, автозаполнение браузера).
        const email = emailRaw.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return null;
        }

        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordsMatch) {
          return null;
        }

        // Деактивированный аккаунт (см. lib/managers/actions.ts) отклоняем
        // той же общей ошибкой, что и неверный пароль — не сообщаем причину
        // отдельно, чтобы не раскрывать сам факт деактивации.
        if (!user.isActive) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          systemRole: user.systemRole,
          financeAccess: user.financeAccess,
        };
      },
    }),
  ],
  callbacks: {
    // authorize() выше вызывается только при входе. Дальше при каждом
    // запросе Auth.js читает уже готовый JWT — поэтому id/systemRole/
    // financeAccess нужно явно перенести из user в token, а из token — в
    // session. financeAccess попадает в токен только при входе — если
    // админ включает его сотруднику, тому нужно перелогиниться, чтобы
    // право подхватилось (тот же компромисс, что и с systemRole).
    jwt({ token, user }) {
      if (user) {
        // user.id типизирован как опциональный в базовом интерфейсе next-auth,
        // но authorize() выше всегда возвращает id — приведение безопасно.
        token.id = user.id!;
        token.systemRole = user.systemRole;
        token.financeAccess = user.financeAccess;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.systemRole = token.systemRole;
      session.user.financeAccess = token.financeAccess;
      return session;
    },
  },
});
