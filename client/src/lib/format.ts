// Валюта — киргизский сом (KGS).
// Тыйыны показываем только когда они есть: доли партнёров после деления прибыли
// дробные, и округление до целого создало бы впечатление, что сумма долей не
// сходится с распределяемой суммой.
export const money = (n: number | undefined | null) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0) + " сом";

// Recharts передаёт значение в форматтер тултипа как `unknown`.
export const moneyTooltip = (v: unknown) => money(Number(v));

// Короткая форма для осей графиков: 1 250 000 → «1.3 млн»
export const shortMoney = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + " млн";
  if (abs >= 1_000) return Math.round(n / 1_000) + " тыс";
  return String(n);
};

export const formatDate = (d: string | Date | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const toInputDate = (d: string | Date = new Date()) =>
  new Date(d).toISOString().slice(0, 10);

export const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

// Изменение к предыдущему периоду (%). Если база 0, процент не имеет смысла.
export const growth = (current: number, previous: number): number | null => {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
};
