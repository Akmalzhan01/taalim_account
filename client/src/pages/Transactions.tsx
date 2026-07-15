import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Plus,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { money, formatDate, toInputDate } from "@/lib/format";
import {
  PAYMENT_LABEL,
  type Category,
  type Order,
  type Transaction,
  type TxType,
} from "@/lib/types";
import { useAuth } from "@/store/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const emptyForm = {
  type: "income" as TxType,
  amount: "",
  date: toInputDate(),
  category: "",
  order: "",
  description: "",
  paymentMethod: "cash",
};

export default function Transactions() {
  const qc = useQueryClient();
  const canWrite = useAuth((s) => s.canWrite());

  const [filters, setFilters] = useState({
    type: "all",
    category: "all",
    from: "",
    to: "",
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const params = {
    ...(filters.type !== "all" && { type: filters.type }),
    ...(filters.category !== "all" && { category: filters.category }),
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", params],
    queryFn: async () => (await api.get("/transactions", { params })).data,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/orders")).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["board"] });
  };

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      editing
        ? (await api.patch(`/transactions/${editing._id}`, payload)).data
        : (await api.post("/transactions", payload)).data,
    onSuccess: () => {
      toast.success(editing ? "Операция обновлена" : "Операция добавлена");
      setOpen(false);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      toast.success("Удалено");
      setDeleting(null);
      invalidate();
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      type: t.type,
      amount: String(t.amount),
      date: toInputDate(t.date),
      category: t.category?._id || "",
      order: t.order?._id || "",
      description: t.description || "",
      paymentMethod: t.paymentMethod,
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) return toast.error("Выберите категорию");
    save.mutate({
      type: form.type,
      amount: Number(form.amount),
      date: form.date,
      category: form.category,
      order: form.order || null,
      description: form.description,
      paymentMethod: form.paymentMethod,
    });
  };

  // Список категорий фильтруется по типу операции — к «приходу» нельзя выбрать
  // категорию расхода (сервер это тоже отклонит).
  const formCategories = categories.filter(
    (c) => c.type === form.type && c.isActive
  );
  const summary = data?.summary || { income: 0, expense: 0, balance: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Все движения денег — приходы и расходы
        </p>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Новая операция
          </Button>
        )}
      </div>

      {/* Итоги по записям, попавшим под фильтр */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ArrowUpCircle className="size-8 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Всего приход</p>
              <p className="text-lg font-semibold">{money(summary.income)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ArrowDownCircle className="size-8 text-rose-600" />
            <div>
              <p className="text-xs text-muted-foreground">Всего расход</p>
              <p className="text-lg font-semibold">{money(summary.expense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Scale className="size-8 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Разница (прибыль)</p>
              <p
                className={
                  summary.balance >= 0
                    ? "text-lg font-semibold text-emerald-600"
                    : "text-lg font-semibold text-rose-600"
                }
              >
                {money(summary.balance)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Тип</Label>
              <Select
                value={filters.type}
                onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="income">Приход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Категория</Label>
              <Select
                value={filters.category}
                onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name} ({c.type === "income" ? "приход" : "расход"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Дата с</Label>
              <Input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Дата по</Label>
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Заказ</TableHead>
                    <TableHead>Оплата</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    {canWrite && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items?.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canWrite ? 7 : 6}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Записи не найдены
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.items?.map((t: Transaction) => (
                    <TableRow key={t._id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(t.date)}
                      </TableCell>
                      <TableCell className="max-w-60 truncate text-sm">
                        {t.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: t.category?.color,
                            color: t.category?.color,
                          }}
                        >
                          {t.category?.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.order?.orderNumber || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {PAYMENT_LABEL[t.paymentMethod]}
                      </TableCell>
                      <TableCell
                        className={
                          t.type === "income"
                            ? "whitespace-nowrap text-right font-semibold text-emerald-600"
                            : "whitespace-nowrap text-right font-semibold text-rose-600"
                        }
                      >
                        {t.type === "income" ? "+" : "−"}
                        {money(t.amount)}
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-rose-600"
                              onClick={() => setDeleting(t)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Добавление / редактирование */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактирование операции" : "Новая операция"}
            </DialogTitle>
            <DialogDescription>
              Если привязать операцию к заказу, оплата и прибыль этого заказа
              пересчитаются автоматически.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Тип</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    // При смене типа категория больше не подходит — сбрасываем.
                    setForm((f) => ({ ...f, type: v as TxType, category: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Приход (доход)</SelectItem>
                    <SelectItem value="expense">Расход</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Сумма (сом)</Label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="15000"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Категория</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите" />
                  </SelectTrigger>
                  <SelectContent>
                    {formCategories.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Заказ (необязательно)</Label>
                <Select
                  value={form.order || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, order: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Нет" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без привязки</SelectItem>
                    {orders.map((o) => (
                      <SelectItem key={o._id} value={o._id}>
                        {o.orderNumber} — {o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Способ оплаты</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, paymentMethod: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Описание</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Например: закуплена бумага для P-0012"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить операцию?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  <b>{money(deleting.amount)}</b> (
                  {deleting.type === "income" ? "приход" : "расход"}) — действие
                  необратимо. Если операция привязана к заказу, сумма оплаты
                  заказа будет пересчитана.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => deleting && remove.mutate(deleting._id)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
