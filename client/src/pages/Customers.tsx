import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { useAuth } from "@/store/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const empty = { name: "", phone: "", company: "", address: "", note: "" };

export default function Customers() {
  const qc = useQueryClient();
  const canWrite = useAuth((s) => s.canWrite());

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(empty);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", q],
    queryFn: async () =>
      (await api.get("/customers", { params: q ? { q } : {} })).data,
  });

  const save = useMutation({
    mutationFn: async (payload: typeof empty) =>
      editing
        ? (await api.patch(`/customers/${editing._id}`, payload)).data
        : (await api.post("/customers", payload)).data,
    onSuccess: () => {
      toast.success(editing ? "Клиент обновлён" : "Клиент добавлен");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone || "",
      company: c.company || "",
      address: c.address || "",
      note: c.note || "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Имя, компания или телефон..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Новый клиент
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead className="text-center">Заказы</TableHead>
                    <TableHead className="text-right">Общая сумма</TableHead>
                    <TableHead className="text-right">Оплачено</TableHead>
                    <TableHead className="text-right">Долг</TableHead>
                    {canWrite && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canWrite ? 7 : 6}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Клиенты не найдены
                      </TableCell>
                    </TableRow>
                  )}
                  {customers.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell>
                        <p className="font-medium">{c.name}</p>
                        {c.company && (
                          <p className="text-xs text-muted-foreground">
                            {c.company}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.phone || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{c.orderCount || 0}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm">
                        {money(c.totalAmount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm text-emerald-600">
                        {money(c.paidAmount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-semibold">
                        {c.dueAmount ? (
                          <span className="text-rose-600">
                            {money(c.dueAmount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEdit(c)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-rose-600"
                              onClick={() => remove.mutate(c._id)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактирование клиента" : "Новый клиент"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Имя *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Телефон</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+996 700 12 34 56"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Компания</Label>
                <Input
                  value={form.company}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, company: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Адрес</Label>
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
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
    </div>
  );
}
