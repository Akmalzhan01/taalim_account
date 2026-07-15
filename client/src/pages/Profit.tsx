import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Calculator,
  Check,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { money, formatDate, MONTHS } from "@/lib/format";
import type { Distribution, DistributionPreview } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-slate-500/10 text-slate-600" },
  approved: { label: "Утверждено", className: "bg-blue-500/10 text-blue-600" },
  paid: { label: "Выплачено полностью", className: "bg-emerald-500/10 text-emerald-600" },
};

// Строка в цепочке расчёта прибыли. Отрицательное значение показываем со знаком
// минус — так видно, что сумма вычитается, а не прибавляется.
function Line({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: number;
  bold?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cn(bold ? "font-medium" : "text-muted-foreground")}>
        {label}
      </span>
      <span className={cn("tabular-nums", bold && "font-semibold text-base", tone)}>
        {value < 0 ? `− ${money(-value)}` : money(value)}
      </span>
    </div>
  );
}

interface DetailRow {
  key: string;
  left: string;
  sub: string;
  value: number;
  hint?: string;
}

function Detail({
  title,
  rows,
  empty,
  note,
}: {
  title: string;
  rows: DetailRow[];
  empty: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-2.5">
        <p className="text-sm font-medium">{title}</p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </div>

      <div className="max-h-64 divide-y overflow-y-auto">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm">{r.left}</p>
              <p className="truncate text-xs text-muted-foreground">{r.sub}</p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  r.value < 0 ? "text-rose-600" : "text-emerald-600"
                )}
              >
                {r.value < 0 ? `− ${money(-r.value)}` : `+ ${money(r.value)}`}
              </p>
              {r.hint && (
                <p className="text-xs text-muted-foreground">{r.hint}</p>
              )}
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Profit() {
  const qc = useQueryClient();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reinvest, setReinvest] = useState("0");

  const [payTarget, setPayTarget] = useState<{
    dist: Distribution;
    partner: string;
    partnerName: string;
    remaining: number;
  } | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const { data: preview, isLoading } = useQuery<DistributionPreview>({
    queryKey: ["dist-preview", year, month, reinvest],
    queryFn: async () =>
      (
        await api.get("/distributions/preview", {
          params: { year, month, reinvestPercent: Number(reinvest) || 0 },
        })
      ).data,
  });

  const { data: distributions = [] } = useQuery<Distribution[]>({
    queryKey: ["distributions"],
    queryFn: async () => (await api.get("/distributions")).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["distributions"] });
    qc.invalidateQueries({ queryKey: ["dist-preview"] });
    qc.invalidateQueries({ queryKey: ["partners"] });
  };

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post("/distributions", {
          year,
          month,
          reinvestPercent: Number(reinvest) || 0,
        })
      ).data,
    onSuccess: () => {
      toast.success("Распределение создано (черновик)");
      invalidate();
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => api.patch(`/distributions/${id}/approve`),
    onSuccess: () => {
      toast.success("Утверждено — теперь можно проводить выплаты");
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/distributions/${id}`),
    onSuccess: () => {
      toast.success("Удалено");
      invalidate();
    },
  });

  const pay = useMutation({
    mutationFn: async () =>
      api.post(`/distributions/${payTarget!.dist._id}/pay`, {
        partner: payTarget!.partner,
        amount: Number(payAmount),
      }),
    onSuccess: () => {
      toast.success("Выплата записана");
      setPayTarget(null);
      setPayAmount("");
      invalidate();
    },
  });

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Прибыль считается по заказам: <b>цена продажи − себестоимость</b> у всех
        заказов, выданных за месяц, минус накладные расходы. Полученное делится
        по долям партнёров. Выплаты <b>не записываются в расходы</b> —
        распределение прибыли не затрата, а деление уже заработанного.
      </p>

      {/* Калькулятор */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4" /> Калькулятор прибыли
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Год</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Месяц</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Реинвестиция (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={reinvest}
                onChange={(e) => setReinvest(e.target.value)}
              />
            </div>
          </div>

          {isLoading || !preview ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              {/* Цепочка расчёта — видно, из чего сложилась прибыль. */}
              <div className="space-y-1.5 rounded-lg border p-4 text-sm">
                <Line
                  label={`Продажи выданных заказов (${preview.orderCount})`}
                  value={preview.revenue}
                />
                <Line
                  label="Себестоимость этих заказов"
                  value={-preview.cogs}
                  tone="text-rose-600"
                />
                <Separator className="my-2" />
                <Line label="Валовая прибыль" value={preview.grossProfit} bold />

                {preview.otherIncome > 0 && (
                  <Line
                    label="Прочий доход (вне заказов)"
                    value={preview.otherIncome}
                    tone="text-emerald-600"
                  />
                )}
                <Line
                  label="Накладные расходы (аренда, зарплата…)"
                  value={-preview.overhead}
                  tone="text-rose-600"
                />
                <Separator className="my-2" />
                <Line
                  label="Чистая прибыль"
                  value={preview.netProfit}
                  bold
                  tone={
                    preview.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                  }
                />
                {preview.reinvestAmount > 0 && (
                  <Line
                    label={`Остаётся в бизнесе (${preview.reinvestPercent}%)`}
                    value={-preview.reinvestAmount}
                    tone="text-blue-600"
                  />
                )}
                <Separator className="my-2" />
                <Line
                  label="К распределению между партнёрами"
                  value={preview.distributable}
                  bold
                  tone="text-blue-600"
                />
              </div>

              {/* Расшифровка. Без неё легко не заметить, что расход на материал
                  забыли привязать к заказу — и он вычелся вторым разом. */}
              <div className="grid gap-3 lg:grid-cols-2">
                <Detail
                  title={`Выданные заказы (${preview.orderCount})`}
                  empty="За этот месяц нет заказов в этапе «Выдан»"
                  rows={preview.orders.map((o) => ({
                    key: o._id,
                    left: `${o.orderNumber} · ${o.title}`,
                    sub: `${money(o.costAmount)} → ${money(o.totalAmount)}`,
                    value: o.profit,
                    hint: `${o.marginPercent}%`,
                  }))}
                />
                <Detail
                  title="Движения вне заказов"
                  empty="Накладных расходов за этот месяц нет"
                  note="Расход на материал должен быть привязан к заказу. Если он здесь — он вычтется из прибыли второй раз, поверх себестоимости."
                  rows={preview.overheadItems.map((t) => ({
                    key: t._id,
                    left: t.category?.name || "—",
                    sub: t.description || formatDate(t.date),
                    value: t.type === "income" ? t.amount : -t.amount,
                  }))}
                />
              </div>

              {!preview.shareValid && (
                <div className="flex items-center gap-3 rounded-lg bg-rose-500/10 px-4 py-3 text-sm">
                  <AlertTriangle className="size-5 shrink-0 text-rose-600" />
                  <span>
                    Партнёрам роздано <b>{preview.shareTotal}%</b> — больше 100%.
                    Уменьшите доли на странице «Партнёры».
                  </span>
                </div>
              )}

              {preview.isLoss && (
                <div className="flex items-center gap-3 rounded-lg bg-rose-500/10 px-4 py-3 text-sm">
                  <AlertTriangle className="size-5 shrink-0 text-rose-600" />
                  <span>
                    Месяц закрыт с <b>убытком</b>. Прибыль не распределяется.
                  </span>
                </div>
              )}

              <Separator />

              <div>
                <p className="mb-3 text-sm font-medium">Кому сколько</p>
                <div className="space-y-2">
                  {preview.shares.map((s) => (
                    <div
                      key={s.partner}
                      className="flex items-center justify-between rounded-lg border px-4 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{s.percent}%</Badge>
                        <span className="text-sm font-medium">{s.partnerName}</span>
                      </div>
                      <span className="font-semibold">{money(s.amount)}</span>
                    </div>
                  ))}

                  {/* Владелец — не партнёр в базе, но в дележе участвует так же. */}
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        {preview.ownerPercent}%
                      </Badge>
                      <span className="text-sm font-medium">Вы (владелец)</span>
                    </div>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {money(preview.ownerAmount)}
                    </span>
                  </div>
                </div>

                {preview.shares.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Партнёрам {money(preview.partnersAmount)} + вам{" "}
                    {money(preview.ownerAmount)} = {money(preview.distributable)}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {preview.existingId ? (
                  <p className="text-sm text-muted-foreground">
                    Распределение за этот месяц уже создано — оно в списке ниже.
                  </p>
                ) : preview.orderCount === 0 ? (
                  <p className="text-sm text-amber-600">
                    За этот месяц не выдано ни одного заказа — делить нечего.
                    Прибыль появится, когда заказ дойдёт до этапа «Выдан».
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    После создания суммы будут заморожены.
                  </p>
                )}
                <Button
                  onClick={() => create.mutate()}
                  disabled={
                    create.isPending ||
                    !!preview.existingId ||
                    !preview.shareValid ||
                    preview.netProfit <= 0
                  }
                >
                  <Check className="size-4" /> Создать распределение
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Сохранённые распределения */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">История распределений</h2>

        {distributions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Распределения ещё не создавались
            </CardContent>
          </Card>
        )}

        {distributions.map((d) => {
          const badge = STATUS_BADGE[d.status];
          return (
            <Card key={d._id}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    {MONTHS[d.month - 1]} {d.year}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Заказов: {d.orderCount} · Продажи {money(d.revenue)} −
                    себестоимость {money(d.cogs)} − накладные {money(d.overhead)}
                    {d.otherIncome > 0 &&
                      ` + прочий доход ${money(d.otherIncome)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Чистая прибыль: <b>{money(d.netProfit)}</b> · Распределено:{" "}
                    {money(d.distributable)}
                    {d.reinvestAmount > 0 &&
                      ` · Осталось в бизнесе: ${money(d.reinvestAmount)}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={badge.className} variant="secondary">
                    {badge.label}
                  </Badge>

                  {d.status === "draft" && (
                    <>
                      <Button size="sm" onClick={() => approve.mutate(d._id)}>
                        <BadgeCheck className="size-3.5" /> Утвердить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600"
                        onClick={() => remove.mutate(d._id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Партнёр</TableHead>
                      <TableHead className="text-center">Доля</TableHead>
                      <TableHead className="text-right">Начислено</TableHead>
                      <TableHead className="text-right">Выплачено</TableHead>
                      <TableHead className="text-right">Осталось</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.shares.map((s) => {
                      const remaining = s.amount - s.paidAmount;
                      return (
                        <TableRow key={s.partner}>
                          <TableCell className="font-medium">
                            {s.partnerName}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{s.percent}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {money(s.amount)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600">
                            {money(s.paidAmount)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold",
                              remaining > 0
                                ? "text-amber-600"
                                : "text-muted-foreground"
                            )}
                          >
                            {remaining > 0 ? money(remaining) : "—"}
                          </TableCell>
                          <TableCell>
                            {d.status !== "draft" && remaining > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPayTarget({
                                    dist: d,
                                    partner: s.partner,
                                    partnerName: s.partnerName,
                                    remaining,
                                  });
                                  setPayAmount(String(remaining));
                                }}
                              >
                                <Wallet className="size-3.5" /> Выплатить
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Доля владельца: выплачивать самому себе нечего — эти
                        деньги и так его, поэтому кнопки выплаты здесь нет. */}
                    <TableRow className="bg-emerald-500/5">
                      <TableCell className="font-medium">Вы (владелец)</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">
                          {d.ownerPercent}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {money(d.ownerAmount)}
                      </TableCell>
                      <TableCell colSpan={3} className="text-right text-xs text-muted-foreground">
                        остаётся вам
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Диалог выплаты */}
      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Выплата партнёру</DialogTitle>
            <DialogDescription>
              {payTarget && (
                <>
                  <b>{payTarget.partnerName}</b> — остаток к выплате:{" "}
                  {money(payTarget.remaining)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              pay.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Сумма выплаты</Label>
              <Input
                type="number"
                min="1"
                max={payTarget?.remaining}
                step="any"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayTarget(null)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={pay.isPending}>
                Записать выплату
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
