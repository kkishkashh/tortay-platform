import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { ProjectRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getActiveContractTemplate } from "@/lib/contract-templates/queries";
import { formatTenge } from "@/lib/utils";

function formatDate(date: Date | null) {
  if (!date) return "";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Список поддерживаемых плейсхолдеров — согласован напрямую (2026-08-06),
// жёстко прописан здесь, не редактируется через интерфейс (см. план,
// пункт 4: "фиксированный список соответствий в коде"). Регистр важен —
// docxtemplater сравнивает теги как есть, {{ГИП}} и {{гип}} — разные теги.
async function buildPlaceholderData(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      number: true,
      clientName: true,
      totalAmount: true,
      requisites: { select: { binIin: true, bankName: true, accountNumber: true, bik: true } },
      project: {
        select: {
          name: true,
          location: true,
          startDate: true,
          endDate: true,
          members: {
            where: { projectRole: ProjectRole.ГИП },
            select: { user: { select: { fullName: true } } },
          },
        },
      },
    },
  });
  if (!contract) {
    throw new Error("Договор не найден");
  }

  const gipNames = contract.project.members.map((m) => m.user.fullName).join(", ");

  return {
    номер_договора: contract.number,
    сумма_договора: formatTenge(Number(contract.totalAmount)),
    заказчик: contract.clientName,
    название_проекта: contract.project.name,
    локация_проекта: contract.project.location ?? "",
    дата_начала: formatDate(contract.project.startDate),
    дата_окончания: formatDate(contract.project.endDate),
    ГИП: gipNames,
    бин_заказчика: contract.requisites?.binIin ?? "",
    банк: contract.requisites?.bankName ?? "",
    иик: contract.requisites?.accountNumber ?? "",
    бик: contract.requisites?.bik ?? "",
    дата_формирования: formatDate(new Date()),
  };
}

// Заполняет активный шаблон компании данными конкретного договора —
// docxtemplater/pizzip читают реальный .docx как zip-контейнер и
// подставляют {{плейсхолдеры}} прямо в XML, не трогая форматирование
// вокруг них. Ничего не сохраняется — договор можно переиздать в любой
// момент из тех же данных (та же логика, что и у аутсорсерского
// buildOutsourcerContractDocx, см. app/api/outsourcers/[id]/contract/route.ts).
export async function fillContractTemplate(
  contractId: string,
): Promise<{ buffer: Buffer; fileName: string; contractNumber: string }> {
  const template = await getActiveContractTemplate();
  if (!template) {
    throw new Error("Шаблон договора ещё не загружен — загрузите его на странице «Договоры»");
  }

  const data = await buildPlaceholderData(contractId);

  const templateResponse = await fetch(template.fileUrl);
  if (!templateResponse.ok) {
    throw new Error("Не удалось загрузить файл шаблона");
  }
  const templateBuffer = Buffer.from(await templateResponse.arrayBuffer());

  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  try {
    doc.render(data);
  } catch (error) {
    // docxtemplater кидает структурированную ошибку с properties.errors —
    // человекочитаемое сообщение полезнее для менеджера, чем стектрейс.
    const message =
      error instanceof Error && "properties" in error
        ? "Ошибка в шаблоне договора — проверьте плейсхолдеры на корректность"
        : "Не удалось заполнить шаблон договора";
    throw new Error(message);
  }

  const buffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;

  return {
    buffer,
    fileName: `Договор ${data.номер_договора}.docx`,
    contractNumber: data.номер_договора,
  };
}
