import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  KanbanSquare,
  Users2,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import {
  money,
  shortMoney,
  moneyTooltip,
  formatDate,
  growth,
  MONTHS,
} from "@/lib/format";
import {
  STATUS_LABEL,
  ORDER_STATUSES,
  type Dashboard as DashboardData,
} from "@/lib/types";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/reports/dashboard")).data,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const { kpi, monthly, topExpense, recent, ordersByStatus, period } = data;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {MONTHS[period.month - 1]} {period.year} — показатели текущего месяца
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Продажи (за месяц)"
          value={money(kpi.revenue)}
          icon={ArrowUpCircle}
          tone="green"
          delta={growth(kpi.revenue, kpi.prevRevenue)}
          hint={`Заказов выдано: ${kpi.orderCount}`}
        />
        <StatCard
          label="Себестоимость"
          value={money(kpi.cogs)}
          icon={ArrowDownCircle}
          tone="red"
          hint="Материалы и работа по выданным заказам"
        />
        <StatCard
          label="Валовая прибыль"
          value={money(kpi.grossProfit)}
          icon={TrendingUp}
          tone={kpi.grossProfit >= 0 ? "green" : "red"}
          hint={
            kpi.revenue
              ? `Рентабельность ${Math.round((kpi.grossProfit / kpi.revenue) * 100)}%`
              : "Нет продаж"
          }
        />
        <StatCard
          label="Чистая прибыль"
          value={money(kpi.netProfit)}
          icon={TrendingUp}
          tone={kpi.netProfit >= 0 ? "green" : "red"}
          delta={growth(kpi.netProfit, kpi.prevNetProfit)}
          hint={`После накладных: ${money(kpi.overhead)}`}
        />
      </div>

      {/* Ради этого всё и считалось: сколько партнёрам, сколько мне. */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Дележ прибыли — {MONTHS[period.month - 1].toLowerCase()}
          </CardTitle>
          <Link
            to="/profit"
            className="text-sm font-medium text-primary hover:underline"
          >
            Распределить →
          </Link>
        </CardHeader>
        <CardContent>
          {kpi.netProfit <= 0 ? (
            <div className="space-y-2 py-2">
              <p className="text-sm text-muted-foreground">
                {kpi.orderCount === 0
                  ? "В этом месяце ещё не выдано ни одного заказа — делить нечего."
                  : "Месяц пока в минусе — накладные расходы больше валовой прибыли."}
              </p>
              {kpi.pipelineProfit > 0 && (
                <p className="text-sm">
                  На доске лежат заказы на{" "}
                  <b className="text-blue-600">{money(kpi.pipelineProfit)}</b>{" "}
                  прибыли. Она попадёт в расчёт, когда заказы перейдут в этап
                  «Выдан».
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {kpi.shares.map((s) => (
                  <div
                    key={s.partner}
                    className="flex items-center justify-between rounded-lg border px-4 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">{s.percent}%</Badge>
                      {s.partnerName}
                    </span>
                    <span className="font-semibold">{money(s.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      {kpi.ownerPercent}%
                    </Badge>
                    Вам
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {money(kpi.ownerAmount)}
                  </span>
                </div>
              </div>

              {kpi.pipelineProfit > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ещё {money(kpi.pipelineProfit)} прибыли лежит в невыданных
                  заказах — в этот расчёт они не входят.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Остаток в кассе"
          value={money(kpi.cash)}
          icon={Wallet}
          tone="blue"
          hint="Реальные деньги: весь приход минус весь расход"
        />
        <StatCard
          label="Долг клиентов"
          value={money(kpi.receivable)}
          icon={Wallet}
          tone="amber"
          hint="Неоплаченный остаток по заказам"
        />
        <StatCard
          label="Активные заказы"
          value={String(kpi.activeOrders)}
          icon={KanbanSquare}
          tone="blue"
          hint="Заказы, ещё не выданные клиенту"
        />
        <StatCard
          label="Клиенты"
          value={String(kpi.customers)}
          icon={Users2}
          tone="slate"
          hint="Количество активных клиентов"
        />
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-sm text-muted-foreground">Состояние канбана</p>
            <div className="space-y-1.5">
              {ORDER_STATUSES.filter((s) => s !== "delivered").map((s) => (
                <div key={s} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
                  <Badge variant="secondary" className="h-5">
                    {ordersByStatus[s] || 0}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Последние 12 месяцев — продажи, затраты и прибыль
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={shortMoney}
                  width={70}
                />
                <Tooltip
                  formatter={moneyTooltip}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Продажи"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gIncome)"
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="Затраты"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#gExpense)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Прибыль"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="transparent"
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Куда ушли деньги (за месяц)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topExpense.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                В этом месяце затрат нет
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topExpense} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={moneyTooltip}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="total" name="Сумма" radius={[0, 4, 4, 0]}>
                    {topExpense.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Последние операции</CardTitle>
          <Link
            to="/transactions"
            className="text-sm font-medium text-primary hover:underline"
          >
            Все →
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Записей пока нет
            </p>
          ) : (
            <div className="divide-y">
              {recent.map((t) => (
                <div key={t._id} className="flex items-center gap-3 py-3">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: t.category?.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.description || t.category?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.category?.name} · {formatDate(t.date)}
                      {t.order ? ` · ${t.order.orderNumber}` : ""}
                    </p>
                  </div>
                  <span
                    className={
                      t.type === "income"
                        ? "shrink-0 text-sm font-semibold text-emerald-600"
                        : "shrink-0 text-sm font-semibold text-rose-600"
                    }
                  >
                    {t.type === "income" ? "+" : "−"}
                    {money(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
