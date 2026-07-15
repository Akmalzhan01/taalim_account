import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { Category, TxType } from "@/lib/types";
import { useAuth } from "@/store/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PALETTE = [
  "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f97316",
  "#eab308", "#06b6d4", "#14b8a6", "#a855f7", "#f43f5e", "#64748b",
];

const empty = { name: "", type: "expense" as TxType, color: "#64748b" };

export default function Categories() {
  const qc = useQueryClient();
  const canWrite = useAuth((s) => s.canWrite());

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(empty);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });

  const save = useMutation({
    mutationFn: async (payload: typeof empty) =>
      editing
        ? (await api.patch(`/categories/${editing._id}`, payload)).data
        : (await api.post("/categories", payload)).data,
    onSuccess: () => {
      toast.success(editing ? "Обновлено" : "Категория добавлена");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const openCreate = (type: TxType) => {
    setEditing(null);
    setForm({ ...empty, type });
    setOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type, color: c.color });
    setOpen(true);
  };

  const groups: { type: TxType; title: string; hint: string }[] = [
    { type: "income", title: "Категории прихода", hint: "Источники дохода" },
    { type: "expense", title: "Категории расхода", hint: "Виды затрат" },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Каждая операция прихода-расхода относится к одной из этих категорий.
        Отчёты строятся именно в этом разрезе.
      </p>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(({ type, title, hint }) => (
            <Card key={type}>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openCreate(type)}
                  >
                    <Plus className="size-3.5" /> Добавить
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-1">
                {categories.filter((c) => c.type === type).length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Пока нет
                  </p>
                )}
                {categories
                  .filter((c) => c.type === type)
                  .map((c) => (
                    <div
                      key={c._id}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ background: c.color }}
                      />
                      <span className="flex-1 text-sm font-medium">{c.name}</span>
                      {!c.isActive && (
                        <Badge variant="secondary" className="h-5 text-[11px]">
                          Неактивна
                        </Badge>
                      )}
                      {canWrite && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-rose-600"
                            onClick={() => remove.mutate(c._id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактирование категории" : "Новая категория"}
            </DialogTitle>
            <DialogDescription>
              Используемую категорию удалить нельзя — сделайте её неактивной.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Бумага и материалы"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Тип</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as TxType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Приход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    style={{ background: color }}
                    className={
                      form.color === color
                        ? "size-8 rounded-full ring-2 ring-foreground ring-offset-2"
                        : "size-8 rounded-full"
                    }
                  />
                ))}
              </div>
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
