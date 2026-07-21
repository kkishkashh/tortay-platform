import nodemailer from "nodemailer";

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
