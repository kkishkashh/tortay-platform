import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildOutsourcerContractDocx } from "@/lib/outsourcers/contract-docx";
import { prisma } from "@/lib/prisma";
import { canManageFinance } from "@/lib/projects/permissions";

// Генерирует .docx на лету из уже сохранённых данных аутсорсера (см.
// updateOutsourcerContractDetailsAction) — ничего не сохраняет в Blob/
// Document, потому что переиздать договор можно в любой момент из тех же
// данных карточки, отдельная история версий не запрашивалась.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;
  const outsourcer = await prisma.outsourcer.findUnique({ where: { id } });
  if (!outsourcer) {
    return NextResponse.json({ error: "Аутсорсер не найден" }, { status: 404 });
  }

  if (
    !outsourcer.iin || !outsourcer.address || !outsourcer.bankName || !outsourcer.bankKbe ||
    !outsourcer.bankAccountNumber || !outsourcer.bankBik || !outsourcer.idCardNumber ||
    !outsourcer.idCardIssuedAt || !outsourcer.idCardIssuedBy || !outsourcer.projectSubject ||
    !outsourcer.durationDays || !outsourcer.totalAmount || !outsourcer.contractNumber ||
    !outsourcer.contractDate
  ) {
    return NextResponse.json(
      { error: "Заполните все поля договора на странице аутсорсера перед генерацией" },
      { status: 400 },
    );
  }

  const buffer = await buildOutsourcerContractDocx({
    fullName: outsourcer.organization,
    iin: outsourcer.iin,
    address: outsourcer.address,
    bankName: outsourcer.bankName,
    bankKbe: outsourcer.bankKbe,
    bankAccountNumber: outsourcer.bankAccountNumber,
    bankBik: outsourcer.bankBik,
    idCardNumber: outsourcer.idCardNumber,
    idCardIssuedAt: outsourcer.idCardIssuedAt,
    idCardIssuedBy: outsourcer.idCardIssuedBy,
    contractNumber: outsourcer.contractNumber,
    contractDate: outsourcer.contractDate,
    projectSubject: outsourcer.projectSubject,
    durationDays: outsourcer.durationDays,
    totalAmount: Number(outsourcer.totalAmount),
    paymentPercent1: outsourcer.paymentPercent1 ?? 60,
    paymentPercent2: outsourcer.paymentPercent2 ?? 20,
    paymentPercent3: outsourcer.paymentPercent3 ?? 20,
  });

  // Кириллица в имени файла требует RFC 5987 (filename*=UTF-8''...) —
  // обычный filename="..." должен оставаться ASCII, иначе часть браузеров
  // подставит бессмысленное имя вместо номера договора.
  const fileName = `Договор ${outsourcer.contractNumber}.docx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="contract.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
