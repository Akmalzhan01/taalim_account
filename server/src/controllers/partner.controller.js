import { z } from "zod";
import Partner from "../models/Partner.js";
import Distribution from "../models/Distribution.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notFound, conflict, badRequest } from "../utils/ApiError.js";

export const partnerSchema = z.object({
  name: z.string().min(2, "Имя — минимум 2 символа"),
  phone: z.string().optional(),
  sharePercent: z.coerce
    .number()
    .min(0, "Доля не может быть меньше 0")
    .max(100, "Доля не может быть больше 100"),
  isActive: z.boolean().optional(),
  note: z.string().optional(),
});

/**
 * Доли активных партнёров и доля владельца.
 *
 * Владельца НЕ нужно заводить партнёром: всё, что не роздано партнёрам, — его.
 * Один партнёр с 50% означает «половина ему, половина мне», а не ошибку.
 * Ошибка — только если партнёрам роздано больше 100%.
 */
export async function activeShareTotal() {
  const partners = await Partner.find({ isActive: true });
  const total = Math.round(partners.reduce((s, p) => s + p.sharePercent, 0) * 100) / 100;
  return {
    partners,
    total,
    ownerPercent: Math.round(Math.max(0, 100 - total) * 100) / 100,
    valid: total <= 100.001,
  };
}

// Партнёрам нельзя раздать больше 100% — владельцу должно остаться не меньше нуля.
async function assertFits(sharePercent, excludeId) {
  const partners = await Partner.find({
    isActive: true,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  const others = partners.reduce((s, p) => s + p.sharePercent, 0);
  const total = others + sharePercent;
  if (total > 100.001) {
    throw badRequest(
      `Партнёрам уже роздано ${others}%. Ещё ${sharePercent}% — это ${Math.round(total * 100) / 100}%, больше 100% раздать нельзя.`
    );
  }
}

export const list = asyncHandler(async (_req, res) => {
  const items = await Partner.find().sort("-isActive -sharePercent name");
  const { total, ownerPercent, valid } = await activeShareTotal();

  // Сколько всего начислено и выплачено каждому партнёру.
  const dists = await Distribution.find({
    status: { $in: ["approved", "paid"] },
  });
  const agg = new Map();
  for (const d of dists) {
    for (const s of d.shares) {
      const key = String(s.partner);
      const cur = agg.get(key) || { earned: 0, paid: 0 };
      cur.earned += s.amount || 0;
      cur.paid += s.paidAmount || 0;
      agg.set(key, cur);
    }
  }

  res.json({
    partners: items.map((p) => {
      const a = agg.get(String(p._id)) || { earned: 0, paid: 0 };
      return {
        ...p.toObject(),
        totalEarned: a.earned,
        totalPaid: a.paid,
        balance: a.earned - a.paid, // сколько бизнес должен этому партнёру
      };
    }),
    shareTotal: total,
    ownerPercent,
    shareValid: valid,
  });
});

export const create = asyncHandler(async (req, res) => {
  if (req.body.isActive !== false) await assertFits(req.body.sharePercent);
  const item = await Partner.create(req.body);
  res.status(201).json(item);
});

export const update = asyncHandler(async (req, res) => {
  const current = await Partner.findById(req.params.id);
  if (!current) throw notFound("Партнёр не найден");

  const nextPercent = req.body.sharePercent ?? current.sharePercent;
  const nextActive = req.body.isActive ?? current.isActive;
  if (nextActive) await assertFits(nextPercent, current._id);

  const item = await Partner.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: "after",
    runValidators: true,
  });
  res.json(item);
});

export const remove = asyncHandler(async (req, res) => {
  // Удаление партнёра, участвовавшего в распределении, ломает историю отчётов.
  const used = await Distribution.countDocuments({
    "shares.partner": req.params.id,
  });
  if (used > 0) {
    throw conflict(
      `Партнёр участвует в ${used} распределениях прибыли. Вместо удаления сделайте его неактивным.`
    );
  }
  const item = await Partner.findByIdAndDelete(req.params.id);
  if (!item) throw notFound("Партнёр не найден");
  res.json({ message: "Удалено" });
});
