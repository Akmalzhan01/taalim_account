import Transaction from "../models/Transaction.js";
import Order from "../models/Order.js";
import { activeShareTotal } from "../controllers/partner.controller.js";

const round = (n) => Math.round(n * 100) / 100;

export function monthRange(year, month) {
  // С 1-го числа месяца до 1-го числа следующего (не включая) — так последний
  // день месяца попадает в выборку целиком.
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { from, to };
}

/**
 * Делит сумму между участниками по их процентам, с точностью до тыйына.
 *
 * Участник — это `{ percent, ...любые поля }`; поля возвращаются как есть, к ним
 * добавляется `amount`. Владелец делит прибыль наравне с партнёрами, поэтому
 * остаток от округления раздаётся по кругу начиная с самой крупной доли: сумма
 * всех `amount` тогда точно равна `total` и на экране ничего не «не сходится».
 */
export function splitByPercent(total, participants) {
  const cents = Math.round(total * 100);
  if (cents <= 0) return participants.map((p) => ({ ...p, amount: 0 }));

  const raw = participants.map((p) => ({
    ...p,
    cents: Math.floor((cents * p.percent) / 100),
  }));

  // order держит ссылки на те же объекты, что и raw, — правим их напрямую.
  let remainder = cents - raw.reduce((s, r) => s + r.cents, 0);
  const order = [...raw].sort((a, b) => b.percent - a.percent);
  let i = 0;
  while (remainder > 0 && order.length) {
    order[i % order.length].cents += 1;
    remainder -= 1;
    i += 1;
  }

  return raw.map(({ cents: c, ...rest }) => ({ ...rest, amount: c / 100 }));
}

/**
 * Прибыль месяца.
 *
 * Считается от заказов, а не от движения денег:
 *
 *   выручка       Σ цена продажи заказов, выданных в этом месяце
 *   себестоимость Σ себестоимость тех же заказов
 *   ────────────────────────────────────────────────────────────
 *   валовая прибыль = выручка − себестоимость
 *   + прочий доход  транзакции прихода БЕЗ привязки к заказу
 *   − накладные     транзакции расхода БЕЗ привязки к заказу (аренда, зарплата)
 *   ────────────────────────────────────────────────────────────
 *   чистая прибыль
 *
 * Транзакции, привязанные к заказу, в прибыль не входят: их сумма уже учтена в
 * себестоимости заказа. Они нужны только для кассы и для сверки плана с фактом.
 * Поэтому материал, купленный для заказа, обязательно привязывайте к нему —
 * иначе он спишется вторично, как накладной расход.
 */
export async function monthProfit(year, month) {
  const { from, to } = monthRange(year, month);

  const [orderRows, txRows] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          status: "delivered",
          deliveredAt: { $gte: from, $lt: to },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
          cogs: { $sum: "$costAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    // order: null — движения, не относящиеся к конкретному заказу.
    Transaction.aggregate([
      { $match: { date: { $gte: from, $lt: to }, order: null } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
  ]);

  const o = orderRows[0] || { revenue: 0, cogs: 0, count: 0 };
  const revenue = round(o.revenue);
  const cogs = round(o.cogs);
  const grossProfit = round(revenue - cogs);

  const otherIncome = round(txRows.find((r) => r._id === "income")?.total || 0);
  const overhead = round(txRows.find((r) => r._id === "expense")?.total || 0);

  return {
    revenue,
    cogs,
    grossProfit,
    otherIncome,
    overhead,
    netProfit: round(grossProfit + otherIncome - overhead),
    orderCount: o.count,
  };
}

/**
 * Расчёт распределения за месяц. Ничего не сохраняет — используется и для
 * превью, и для создания распределения.
 *
 * Владелец участвует в дележе наравне с партнёрами: его доля — это всё, что не
 * роздано (100% − доли партнёров). Заводить себя партнёром не нужно.
 */
export async function computeMonth(year, month, reinvestPercent = 0) {
  const p = await monthProfit(year, month);
  const netProfit = p.netProfit;

  const {
    partners,
    total: shareTotal,
    ownerPercent,
    valid: shareValid,
  } = await activeShareTotal();

  // При убытке распределять нечего — всем записывается 0.
  const base = Math.max(0, netProfit);
  const reinvestAmount = round((base * reinvestPercent) / 100);
  const distributable = round(base - reinvestAmount);

  // Владелец идёт в тот же сплит, что и партнёры, — иначе из-за округления
  // сумма «партнёрам + мне» не сошлась бы с распределяемой.
  const OWNER = Symbol("owner");
  const split = splitByPercent(distributable, [
    ...partners.map((x) => ({
      partner: x._id,
      partnerName: x.name,
      percent: x.sharePercent,
    })),
    { key: OWNER, percent: ownerPercent },
  ]);

  const ownerAmount = split.find((s) => s.key === OWNER)?.amount || 0;
  const shares = split.filter((s) => s.key !== OWNER);
  const partnersAmount = round(shares.reduce((s, x) => s + x.amount, 0));

  return {
    year,
    month,
    ...p,
    reinvestPercent,
    reinvestAmount,
    distributable,
    shares,
    partnersAmount,
    ownerPercent,
    ownerAmount,
    shareTotal,
    shareValid,
    isLoss: netProfit < 0,
  };
}
