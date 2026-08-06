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
      // ГИП или МЕНЕДЖЕР хотя бы одного проекта на момент входа — даёт те
      // же операционные права, что и системная роль РУКОВОДИТЕЛЬ, по всей
      // компании (см. lib/projects/permissions.ts). Тот же компромисс,
      // что и с financeAccess/systemRole: подхватывается только при входе.
      isProjectLead: boolean;
      // Точечный доступ "видеть/управлять любым проектом компании"
      // (2026-08-06, для руководителя/ГАП Архитектуры) — тот же принцип,
      // что и financeAccess: отдельный флаг, не привязан к systemRole.
      allProjectsAccess: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    systemRole: SystemRole;
    financeAccess: boolean;
    isProjectLead: boolean;
    allProjectsAccess: boolean;
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
    isProjectLead: boolean;
    allProjectsAccess: boolean;
  }
}
