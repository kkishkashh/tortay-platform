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
