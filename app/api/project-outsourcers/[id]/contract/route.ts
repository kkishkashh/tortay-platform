import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildOutsourcerContractDocx } from "@/lib/outsourcers/contract-docx";
import { prisma } from "@/lib/prisma";
import { canManageFinance } from "@/lib/projects/permissions";

// То же, что app/api/outsourcers/[id]/contract/route.ts, но для договора
// по КОНКРЕТНОМУ проекту (ProjectOutsourcer) — реквизиты исполнителя
// (ИИН/адрес/банк/удостоверение) берутся из самого Outsourcer (не меняются
// от проекта к проекту), а предмет/сумма/транши — из этой записи.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !(await canManageFinance(session.user))) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;
  const engagement = await prisma.projectOutsourcer.findUnique({
    where: { id },
    include: { outsourcer: true },
  });
  if (!engagement) {
    return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
  }

  const outsourcer = engagement.outsourcer;
  if (
    !outsourcer.iin || !outsourcer.address || !outsourcer.bankName || !outsourcer.bankKbe ||
    !outsourcer.bankAccountNumber || !outsourcer.bankBik || !outsourcer.idCardNumber ||
    !outsourcer.idCardIssuedAt || !outsourcer.idCardIssuedBy
  ) {
    return NextResponse.json(
      { error: "Сначала заполните реквизиты исполнителя на странице аутсорсера (ИИН, адрес, банк, удостоверение)" },
      { status: 400 },
    );
  }
  if (
    !engagement.projectSubject || !engagement.durationDays || !engagement.totalAmount ||
    !engagement.contractNumber || !engagement.contractDate
  ) {
    return NextResponse.json(
      { error: "Заполните предмет договора, срок и сумму перед генерацией" },
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
    contractNumber: engagement.contractNumber,
    contractDate: engagement.contractDate,
    projectSubject: engagement.projectSubject,
    durationDays: engagement.durationDays,
    totalAmount: Number(engagement.totalAmount),
    paymentPercent1: engagement.paymentPercent1 ?? 60,
    paymentPercent2: engagement.paymentPercent2 ?? 20,
    paymentPercent3: engagement.paymentPercent3 ?? 20,
  });

  const fileName = `Договор ${engagement.contractNumber}.docx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="contract.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
