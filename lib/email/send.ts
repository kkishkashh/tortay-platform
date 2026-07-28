import { Resend } from "resend";

// Тот же принцип толерантности, что и раньше: письмо со ссылкой для входа
// всё равно уходит, просто со ссылкой на прод-домен по умолчанию.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tortay.kz";
if (!process.env.NEXT_PUBLIC_APP_URL) {
  console.warn(
    "[email] NEXT_PUBLIC_APP_URL не задан — ссылка для входа в письмах будет вести на URL по умолчанию",
  );
}

// Отправка через Resend с верифицированного домена tortay.kz (см. настройку
// DNS-записей в Cloudflare) — раньше здесь был Gmail SMTP, потому что у
// компании ещё не было своего подтверждённого домена. Письма реально
// доходят до сотрудников: MX для tortay.kz указывает на почтовый сервер
// ps.kz, где у каждого сотрудника уже есть свой ящик @tortay.kz.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = `Tortay Engineering <noreply@${process.env.RESEND_EMAIL_DOMAIN ?? "tortay.kz"}>`;

export async function sendVerificationCodeEmail({
  to,
  code,
}: {
  to: string;
  code: string;
}) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY не задан — код подтверждения (${to}) не отправлен`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Код подтверждения: ${code}`,
    html: `
      <p>Здравствуйте!</p>
      <p>Ваш код подтверждения для входа в Tortay Engineering:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
      <p>Код действует 15 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.</p>
    `,
  });
}

export async function sendGipAssignedEmail({
  to,
  employeeName,
  projectName,
  assignedByName,
}: {
  to: string;
  employeeName: string;
  projectName: string;
  assignedByName: string;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY не задан — письмо о назначении ГИП (${to}, проект «${projectName}») не отправлено`,
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Вас назначили ГИП проекта «${projectName}»`,
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>${assignedByName} назначил(а) вас главным инженером проекта (ГИП) на проекте «${projectName}» в Tortay Engineering.</p>
      <p>Подробности — в личном кабинете на платформе.</p>
    `,
  });
}

export async function sendTaskAssignedEmail({
  to,
  employeeName,
  taskTitle,
  projectName,
  deadline,
}: {
  to: string;
  employeeName: string;
  taskTitle: string;
  projectName: string;
  deadline: Date | null;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY не задан — письмо о назначении задачи (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  const deadlineLine = deadline
    ? `<p>Срок: ${deadline.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}</p>`
    : "";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Вам назначена задача «${taskTitle}»`,
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Вам назначена новая задача «${taskTitle}» в проекте «${projectName}».</p>
      ${deadlineLine}
      <p>Подробности — в разделе «Мои задачи» на платформе.</p>
    `,
  });
}

export async function sendTaskReadyForReviewEmail({
  to,
  managerName,
  taskTitle,
  employeeName,
  projectName,
}: {
  to: string;
  managerName: string;
  taskTitle: string;
  employeeName: string;
  projectName: string;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY не задан — письмо о готовности задачи к проверке (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Задача «${taskTitle}» готова к проверке`,
    html: `
      <p>Здравствуйте, ${managerName}!</p>
      <p>${employeeName} отправил(а) задачу «${taskTitle}» на проверку в проекте «${projectName}».</p>
      <p>Требуется проверка — подробности на платформе.</p>
    `,
  });
}

export async function sendTaskStartedEmail({
  to,
  managerName,
  taskTitle,
  employeeName,
  projectName,
}: {
  to: string;
  managerName: string;
  taskTitle: string;
  employeeName: string;
  projectName: string;
}) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY не задан — письмо о начале работы (${to}, «${taskTitle}») не отправлено`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${employeeName} взял(а) в работу задачу «${taskTitle}»`,
    html: `
      <p>Здравствуйте, ${managerName}!</p>
      <p>${employeeName} начал(а) работу над задачей «${taskTitle}» в проекте «${projectName}».</p>
    `,
  });
}

export async function sendManagerCreatedEmail({
  to,
  employeeName,
  username,
  temporaryPassword,
  departmentName,
}: {
  to: string;
  employeeName: string;
  username: string | null;
  temporaryPassword: string;
  departmentName: string | null;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY не задан — письмо о создании аккаунта руководителя (${to}) не отправлено`,
    );
    return;
  }

  const loginLink = `${APP_URL}/login`;
  const usernameLine = username ? `<p>Логин (для справки): ${username}</p>` : "";
  const departmentLine = departmentName
    ? `<p>Вам назначен департамент «${departmentName}».</p>`
    : "";

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Для вас создан аккаунт руководителя в Tortay Engineering",
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Для вас создан аккаунт руководителя в Tortay Engineering.</p>
      ${departmentLine}
      <p>Email для входа: ${to}</p>
      ${usernameLine}
      <p>Временный пароль: <strong>${temporaryPassword}</strong></p>
      <p>Рекомендуем сменить пароль после первого входа в личном кабинете.</p>
      <p><a href="${loginLink}">Войти в платформу</a></p>
    `,
  });
}

// ============================================================
// Phase 14 — расширение уведомлений/писем (см. план).
// ============================================================

export async function sendEmployeeCreatedEmail({
  to,
  employeeName,
  temporaryPassword,
  departmentName,
}: {
  to: string;
  employeeName: string;
  temporaryPassword: string;
  departmentName: string | null;
}) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY не задан — приветственное письмо (${to}) не отправлено`);
    return;
  }

  const departmentLine = departmentName
    ? `<p>Вам назначен департамент «${departmentName}».</p>`
    : "";

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Добро пожаловать в Tortay Engineering",
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Для вас создан аккаунт сотрудника в Tortay Engineering.</p>
      ${departmentLine}
      <p>Email для входа: ${to}</p>
      <p>Временный пароль: <strong>${temporaryPassword}</strong></p>
      <p>Рекомендуем сменить пароль после первого входа в личном кабинете.</p>
      <p><a href="${APP_URL}/login">Войти в платформу</a></p>
    `,
  });
}

export async function sendPositionChangedEmail({
  to,
  employeeName,
  position,
}: {
  to: string;
  employeeName: string;
  position: string;
}) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY не задан — письмо о новой должности (${to}) не отправлено`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Вам назначена новая должность: ${position}`,
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Ваша должность в Tortay Engineering изменена на «${position}».</p>
    `,
  });
}

export async function sendDepartmentAssignedEmail({
  to,
  employeeName,
  departmentName,
}: {
  to: string;
  employeeName: string;
  departmentName: string;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY не задан — письмо о назначении в департамент (${to}) не отправлено`,
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Вас добавили в департамент «${departmentName}»`,
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Вы теперь состоите в департаменте «${departmentName}» в Tortay Engineering.</p>
    `,
  });
}

export async function sendDeadlineChangedEmail({
  to,
  employeeName,
  taskTitle,
  projectName,
  deadline,
}: {
  to: string;
  employeeName: string;
  taskTitle: string;
  projectName: string;
  deadline: Date | null;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY не задан — письмо об изменении срока (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  const deadlineLine = deadline
    ? `<p>Новый срок: ${deadline.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}</p>`
    : "<p>Срок снят.</p>";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Изменён срок задачи «${taskTitle}»`,
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Срок задачи «${taskTitle}» в проекте «${projectName}» был изменён.</p>
      ${deadlineLine}
    `,
  });
}

export async function sendTaskReturnedEmail({
  to,
  employeeName,
  taskTitle,
  projectName,
}: {
  to: string;
  employeeName: string;
  taskTitle: string;
  projectName: string;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY не задан — письмо о возврате задачи (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Задача «${taskTitle}» возвращена на доработку`,
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Задача «${taskTitle}» в проекте «${projectName}» возвращена вам на доработку.</p>
    `,
  });
}

export async function sendTaskApprovedEmail({
  to,
  employeeName,
  taskTitle,
  projectName,
}: {
  to: string;
  employeeName: string;
  taskTitle: string;
  projectName: string;
}) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY не задан — письмо об одобрении задачи (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Задача «${taskTitle}» одобрена`,
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Ваша задача «${taskTitle}» в проекте «${projectName}» принята выполненной.</p>
    `,
  });
}

export async function sendPasswordResetEmail({
  to,
  employeeName,
  temporaryPassword,
}: {
  to: string;
  employeeName: string;
  temporaryPassword: string;
}) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY не задан — письмо о сбросе пароля (${to}) не отправлено`);
    return;
  }

  const loginLink = `${APP_URL}/login`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Ваш пароль был сброшен",
    html: `
      <p>Здравствуйте, ${employeeName}!</p>
      <p>Администратор сбросил пароль вашей учётной записи в Tortay Engineering.</p>
      <p>Новый временный пароль: <strong>${temporaryPassword}</strong></p>
      <p>Рекомендуем сменить пароль после входа в личном кабинете.</p>
      <p><a href="${loginLink}">Войти в платформу</a></p>
    `,
  });
}
