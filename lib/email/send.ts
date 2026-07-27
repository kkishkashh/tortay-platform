import nodemailer from "nodemailer";

// Тот же принцип толерантности, что и у GMAIL_*: письмо со ссылкой для
// входа всё равно уходит, просто со ссылкой на прод-домен по умолчанию.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tortay-platform.vercel.app";
if (!process.env.NEXT_PUBLIC_APP_URL) {
  console.warn(
    "[email] NEXT_PUBLIC_APP_URL не задан — ссылка для входа в письмах будет вести на URL по умолчанию",
  );
}

// Отправка через личный Gmail руководителя (SMTP + App Password), а не
// через Resend: у компании нет своего домена, а Resend без верифицированного
// домена физически отказывается слать письма на чужие адреса (только на
// адрес, которым зарегистрирован аккаунт) — см. обсуждение при подключении.
// Gmail SMTP такого ограничения не имеет и бесплатен (лимит ~500 писем/день).
const transporter =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      })
    : null;

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
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо о назначении ГИП (${to}, проект «${projectName}») не отправлено`,
    );
    return;
  }

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо о назначении задачи (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  const deadlineLine = deadline
    ? `<p>Срок: ${deadline.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}</p>`
    : "";

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо о готовности задачи к проверке (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
    to,
    subject: `Задача «${taskTitle}» готова к проверке`,
    html: `
      <p>Здравствуйте, ${managerName}!</p>
      <p>${employeeName} отправил(а) задачу «${taskTitle}» на проверку в проекте «${projectName}».</p>
      <p>Требуется проверка — подробности на платформе.</p>
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
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо о создании аккаунта руководителя (${to}) не отправлено`,
    );
    return;
  }

  const loginLink = `${APP_URL}/login`;
  const usernameLine = username ? `<p>Логин (для справки): ${username}</p>` : "";
  const departmentLine = departmentName
    ? `<p>Вам назначен департамент «${departmentName}».</p>`
    : "";

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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
  if (!transporter) {
    console.warn(`[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — приветственное письмо (${to}) не отправлено`);
    return;
  }

  const departmentLine = departmentName
    ? `<p>Вам назначен департамент «${departmentName}».</p>`
    : "";

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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

export async function sendDepartmentAssignedEmail({
  to,
  employeeName,
  departmentName,
}: {
  to: string;
  employeeName: string;
  departmentName: string;
}) {
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо о назначении в департамент (${to}) не отправлено`,
    );
    return;
  }

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо об изменении срока (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  const deadlineLine = deadline
    ? `<p>Новый срок: ${deadline.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}</p>`
    : "<p>Срок снят.</p>";

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо о возврате задачи (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо об одобрении задачи (${to}, «${taskTitle}») не отправлено`,
    );
    return;
  }

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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
  if (!transporter) {
    console.warn(
      `[email] GMAIL_USER/GMAIL_APP_PASSWORD не заданы — письмо о сбросе пароля (${to}) не отправлено`,
    );
    return;
  }

  const loginLink = `${APP_URL}/login`;

  await transporter.sendMail({
    from: `Tortay Engineering <${process.env.GMAIL_USER}>`,
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
