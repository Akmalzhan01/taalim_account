import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Partner } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PartnersResponse {
  partners: Partner[];
  /** Сумма долей партнёров — без владельца */
  shareTotal: number;
  /** Доля владельца: всё, что не роздано партнёрам */
  ownerPercent: number;
  /** false, только если партнёрам роздано больше 100% */
  shareValid: boolean;
}

const empty = { name: "", phone: "", sharePercent: "", note: "" };

export default function Partners() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery<PartnersResponse>({
    queryKey: ["partners"],
    queryFn: async () => (await api.get("/partners")).data,
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      editing
        ? (await api.patch(`/partners/${editing._id}`, payload)).data
        : (await api.post("/partners", payload)).data,
    onSuccess: () => {
      toast.success(editing ? "Партнёр обновлён" : "Партнёр добавлен");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/partners/${id}`),
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: ["partners"] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (p: Partner) =>
      api.patch(`/partners/${p._id}`, { isActive: !p.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name,
      phone: p.phone || "",
      sharePercent: String(p.sharePercent),
      note: p.note || "",
    });
    setOpen(true);
  };

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-52" />
        ))}
      </div>
    );
  }

  const { partners, shareTotal, ownerPercent, shareValid } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Себя добавлять партнёром не нужно — всё, что не роздано, ваше
        </p>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Новый партнёр
        </Button>
      </div>

      {/* Главный ответ страницы: сколько партнёрам, сколько мне. */}
      <Card
        className={cn(
          "border-l-4",
          shareValid ? "border-l-emerald-500" : "border-l-rose-500"
        )}
      >
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {shareValid ? (
              <CheckCircle2 className="size-8 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-8 shrink-0 text-rose-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                Партнёрам: {shareTotal}% · Вам: {ownerPercent}%
              </p>
              <p className="text-sm text-muted-foreground">
                {shareValid
                  ? "Так будет делиться чистая прибыль каждого месяца"
                  : `Партнёрам роздано ${shareTotal}% — больше 100%. Уменьшите доли, иначе распределять нечего.`}
              </p>
            </div>
          </div>

          {/* Полоса на 100%: слева партнёры, справа — владелец. */}
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {partners
              .filter((p) => p.isActive)
              .map((p, i) => (
                <div
                  key={p._id}
                  title={`${p.name} — ${p.sharePercent}%`}
                  className={cn(
                    "h-full",
                    i % 2 === 0 ? "bg-blue-500" : "bg-violet-500"
                  )}
                  style={{ width: `${Math.min(100, p.sharePercent)}%` }}
                />
              ))}
            <div
              title={`Вы — ${ownerPercent}%`}
              className="h-full bg-emerald-500"
              style={{ width: `${ownerPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {partners
              .filter((p) => p.isActive)
              .map((p) => (
                <span key={p._id} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" />
                  {p.name} — {p.sharePercent}%
                </span>
              ))}
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              Вы (владелец) — {ownerPercent}%
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {partners.map((p) => (
          <Card key={p._id} className={cn(!p.isActive && "opacity-60")}>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.phone || "Телефон не указан"}
                  </p>
                </div>
                <Badge variant={p.isActive ? "default" : "secondary"}>
                  {p.sharePercent}%
                </Badge>
              </div>

              <Progress value={p.sharePercent} className="h-1.5" />

              <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Всего начислено</p>
                  <p className="font-medium">{money(p.totalEarned)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Выплачено</p>
                  <p className="font-medium text-emerald-600">
                    {money(p.totalPaid)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Бизнес должен партнёру
                </p>
                <p
                  className={cn(
                    "text-lg font-semibold",
                    p.balance > 0 ? "text-amber-600" : "text-muted-foreground"
                  )}
                >
                  {money(p.balance)}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEdit(p)}
                >
                  <Pencil className="size-3.5" /> Изменить
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive.mutate(p)}
                >
                  {p.isActive ? "Отключить" : "Включить"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-rose-600"
                  onClick={() => remove.mutate(p._id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {partners.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Партнёры пока не добавлены
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактирование партнёра" : "Новый партнёр"}
            </DialogTitle>
            <DialogDescription>
              Укажите долю партнёра. Остаток до 100% — ваша доля, отдельно
              заводить себя не нужно. Сейчас партнёрам роздано {shareTotal}%.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({
                name: form.name,
                phone: form.phone,
                sharePercent: Number(form.sharePercent),
                note: form.note,
              });
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
                  placeholder="+996 700 ..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Доля (%) *</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.sharePercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sharePercent: e.target.value }))
                  }
                  placeholder="50"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Заметка</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Основатель, инвестор..."
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
