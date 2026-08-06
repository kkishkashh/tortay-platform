"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { FileText, Upload } from "lucide-react";

import { setActiveContractTemplateAction } from "@/lib/contract-templates/actions";
import type { ContractTemplateInfo } from "@/lib/contract-templates/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Загрузка нового шаблона ПОЛНОСТЬЮ заменяет активный (см.
// setActiveContractTemplateAction — старый становится неактивным, не
// удаляется) — поэтому диалог, а не мгновенная загрузка по клику, чтобы
// не подменить общий на всю компанию шаблон случайно.
export function ChangeTemplateDialog({
  currentTemplate,
}: {
  currentTemplate: ContractTemplateInfo | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (file.type !== ALLOWED_TYPE) {
      setError("Поддерживается только .docx (Word)");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Файл больше 10 МБ");
      return;
    }

    setSelectedFile(file);
  }

  function handleUpload() {
    if (!selectedFile) return;
    setError(null);

    startTransition(async () => {
      try {
        const blob = await upload(`contract-templates/${selectedFile.name}`, selectedFile, {
          access: "public",
          handleUploadUrl: "/api/uploads/contract-template",
        });
        await setActiveContractTemplateAction(blob.url, selectedFile.name);
        setOpen(false);
        setSelectedFile(null);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "Не удалось загрузить файл",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelectedFile(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <FileText className="size-4" />
        Поменять шаблон договора
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Шаблон договора</DialogTitle>
          <DialogDescription>
            Один общий шаблон на всю компанию — загрузка нового полностью заменяет текущий
            для всех будущих договоров.
          </DialogDescription>
        </DialogHeader>

        {currentTemplate ? (
          <p className="text-sm text-muted-foreground">
            Сейчас активен: <span className="font-medium text-foreground">{currentTemplate.fileName}</span>
            {" · загрузил(а) "}
            {currentTemplate.uploadedByName}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Шаблон ещё не загружен.</p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPE}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          {selectedFile ? selectedFile.name : "Выбрать файл .docx"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Word-документ с плейсхолдерами вида {"{{сумма_договора}}"}, до 10 МБ.
        </p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button onClick={handleUpload} disabled={isPending || !selectedFile}>
            {isPending ? "Загружаем…" : "Заменить шаблон"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
