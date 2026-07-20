import { Resend } from "resend";

// Без ключа (например, на локальной машине разработчика без .env)
// письма не отправляются, а просто логируются — чтобы остальной код
// (создание проекта и т.д.) не падал из-за отсутствующей интеграции.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Домен-песочница Resend — работает сразу без верификации своего домена,
// но письма уходят с адреса resend.dev. Когда появится верифицированный
// домен компании, достаточно поменять только эту константу.
const FROM = "Tortay Engineering <onboarding@resend.dev>";

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
