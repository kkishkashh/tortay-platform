// Числительное прописью на русском — для договоров (сумма и срок всегда
// дублируются цифрами и прописью, см. lib/outsourcers/contract-docx.ts).
// Стандартный алгоритм: разбиваем на группы по 3 разряда, каждую группу
// озвучиваем как 0-999, добавляя склонённое слово разряда (тысяча/миллион/…).
const UNITS_MASCULINE = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const UNITS_FEMININE = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

// forms = [именительный ед.ч. ("один день"), родительный ед.ч. ("два дня"),
// родительный мн.ч. ("пять дней")] — стандартное русское склонение по
// числительному, 11-14 всегда родительный мн.ч. независимо от последней цифры.
export function pluralFormRu(n: number, forms: [string, string, string]): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function convertThreeDigits(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) words.push(HUNDREDS[hundreds]);
  if (rest >= 10 && rest < 20) {
    words.push(TEENS[rest - 10]);
  } else {
    const tens = Math.floor(rest / 10);
    const units = rest % 10;
    if (tens > 0) words.push(TENS[tens]);
    if (units > 0) words.push((feminine ? UNITS_FEMININE : UNITS_MASCULINE)[units]);
  }
  return words;
}

type Scale = { forms: [string, string, string]; feminine: boolean };
// Индекс — номер группы по 3 разряда (0 = единицы, 1 = тысячи, ...).
const SCALES: Scale[] = [
  { forms: ["", "", ""], feminine: false },
  { forms: ["тысяча", "тысячи", "тысяч"], feminine: true },
  { forms: ["миллион", "миллиона", "миллионов"], feminine: false },
  { forms: ["миллиард", "миллиарда", "миллиардов"], feminine: false },
];

export function numberToWordsRu(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "ноль";

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (group === 0) continue;
    const scale = SCALES[i] ?? SCALES[SCALES.length - 1];
    parts.push(...convertThreeDigits(group, scale.feminine));
    if (i > 0) {
      parts.push(pluralFormRu(group, scale.forms));
    }
  }
  return parts.join(" ");
}

// "400 000" — цифры с пробелом между разрядами, как принято в KZ/RU
// договорах (см. образец: "400 000 (четыреста тысяч) тенге").
export function formatThousandsRu(value: number): string {
  return Math.floor(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
