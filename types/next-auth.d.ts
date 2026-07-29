import { SystemRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

// Auth.js по умолчанию кладёт в сессию только email/name/image.
// Нам нужны ещё id и systemRole — расширяем типы, чтобы TypeScript
// знал про эти поля везде, где используется useSession()/auth().
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
      financeAccess: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    systemRole: SystemRole;
    financeAccess: boolean;
  }
}

// next-auth/jwt — это просто `export *` из @auth/core/jwt, поэтому
// TypeScript не смёржит аугментацию через него: колбэки NextAuth()
// типизированы через оригинальный модуль @auth/core/jwt напрямую.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    systemRole: SystemRole;
    financeAccess: boolean;
  }
}
