import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Download } from "lucide-react";

import { api } from "@/lib/api";
import { money, moneyTooltip, toInputDate } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Row {
  categoryId: string;
  name: string;
  color: string;
  type: string;
  total: number;
  count: number;
}

interface Summary {
  totals: { income: number; expense: number; profit: number };
  income: Row[];
  expense: Row[];
}

const startOfYear = () => toInputDate(new Date(new Date().getFullYear(), 0, 1));

export default function Reports() {
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(toInputDate());

  const { data, isLoading } = useQuery<Summary>({
    queryKey: ["summary", from, to],
    queryFn: async () =>
      (await api.get("/reports/summary", { params: { from, to } })).data,
  });

  // CSV для открытия в Excel. Добавляем BOM, иначе кириллица показывается
  // «кракозябрами».
  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Тип", "Категория", "Кол-во записей", "Сумма"],
      ...data.income.map((r) => ["Приход", r.name, r.count, r.total]),
      ...data.expense.map((r) => ["Расход", r.name, r.count, r.total]),
      [],
      ["", "Всего приход", "", data.totals.income],
      ["", "Всего расход", "", data.totals.expense],
      ["", "Чистая прибыль", "", data.totals.profit],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `otchet_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const section = (title: string, rows: Row[], total: number) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            За этот период записей нет
          </p>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="total"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {rows.map((r) => (
                    <Cell key={r.categoryId} fill={r.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={moneyTooltip}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-3">
              {rows.map((r) => {
                const pct = total ? Math.round((r.total / total) * 100) : 0;
                return (
                  <div key={r.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: r.color }}
                        />
                        {r.name}
                        <span className="text-xs text-muted-foreground">
                          ({r.count} шт)
                        </span>
                      </span>
                      <span className="font-medium">
                        {money(r.total)}{" "}
                        <span className="text-xs text-muted-foreground">
                          {pct}%
                        </span>
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Дата с</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Дата по</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!data}>
            <Download className="size-4" /> Скачать CSV
          </Button>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Всего приход</p>
                <p className="text-2xl font-semibold text-emerald-600">
                  {money(data.totals.income)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Всего расход</p>
                <p className="text-2xl font-semibold text-rose-600">
                  {money(data.totals.expense)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Чистая прибыль</p>
                <p
                  className={
                    data.totals.profit >= 0
                      ? "text-2xl font-semibold text-emerald-600"
                      : "text-2xl font-semibold text-rose-600"
                  }
                >
                  {money(data.totals.profit)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {section("Категории прихода", data.income, data.totals.income)}
            {section("Категории расхода", data.expense, data.totals.expense)}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Сводная таблица</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead className="text-center">Записей</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.income, ...data.expense].map((r) => (
                    <TableRow key={r.categoryId + r.type}>
                      <TableCell
                        className={
                          r.type === "income"
                            ? "font-medium text-emerald-600"
                            : "font-medium text-rose-600"
                        }
                      >
                        {r.type === "income" ? "Приход" : "Расход"}
                      </TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-center">{r.count}</TableCell>
                      <TableCell className="text-right font-medium">
                        {money(r.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
