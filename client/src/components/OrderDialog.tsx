import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { money, toInputDate } from "@/lib/format";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  type Customer,
  type Order,
  type Priority,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface ItemRow {
  name: string;
  qty: string;
  unitCost: string;
  unitPrice: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null — новый заказ, иначе редактирование */
  order: Order | null;
}

const emptyItem: ItemRow = { name: "", qty: "1", unitCost: "", unitPrice: "" };

export default function OrderDialog({ open, onOpenChange, order }: Props) {
  const qc = useQueryClient();

  const [customer, setCustomer] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("new");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...emptyItem }]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });

  // При открытии подгоняем форму под редактируемый заказ.
  useEffect(() => {
    if (!open) return;
    if (order) {
      setCustomer(order.customer?._id || "");
      setTitle(order.title);
      setDescription(order.description || "");
      setStatus(order.status);
      setPriority(order.priority);
      setDeadline(order.deadline ? toInputDate(order.deadline) : "");
      setItems(
        order.items.map((i) => ({
          name: i.name,
          qty: String(i.qty),
          unitCost: i.unitCost ? String(i.unitCost) : "",
          unitPrice: String(i.unitPrice),
        }))
      );
    } else {
      setCustomer("");
      setTitle("");
      setDescription("");
      setStatus("new");
      setPriority("medium");
      setDeadline("");
      setItems([{ ...emptyItem }]);
    }
  }, [open, order]);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      order
        ? (await api.patch(`/orders/${order._id}`, payload)).data
        : (await api.post("/orders", payload)).data,
    onSuccess: () => {
      toast.success(order ? "Заказ обновлён" : "Заказ создан");
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
    },
  });

  // Те же формулы, что и на сервере, — цифры в форме должны совпадать с тем,
  // что запишется в базу.
  const total = items.reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0),
    0
  );
  const cost = items.reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.unitCost) || 0),
    0
  );
  const profit = total - cost;
  const margin = total ? Math.round((profit / total) * 1000) / 10 : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return toast.error("Выберите клиента");

    const clean = items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        qty: Number(i.qty) || 0,
        unitCost: Number(i.unitCost) || 0,
        unitPrice: Number(i.unitPrice) || 0,
      }));

    if (clean.length === 0) return toast.error("Добавьте хотя бы одну позицию");

    save.mutate({
      customer,
      title,
      description,
      items: clean,
      status,
      priority,
      deadline: deadline || null,
    });
  };

  const patchItem = (idx: number, key: keyof ItemRow, value: string) =>
    setItems((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {order ? `Заказ ${order.orderNumber}` : "Новый заказ"}
          </DialogTitle>
          <DialogDescription>
            Укажите себестоимость и цену продажи — прибыль заказа считается из
            них. В прибыль месяца заказ попадёт, когда перейдёт в этап «Выдан».
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Клиент</Label>
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите клиента" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name} {c.company ? `— ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Заголовок</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Фирменные визитки"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Этап</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...ORDER_STATUSES, "cancelled"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Приоритет</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Срок</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Позиции</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((r) => [...r, { ...emptyItem }])}
              >
                <Plus className="size-3.5" /> Строка
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const qty = Number(item.qty) || 0;
                const lineProfit =
                  qty *
                  ((Number(item.unitPrice) || 0) - (Number(item.unitCost) || 0));
                return (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      {idx === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Наименование
                        </span>
                      )}
                      <Input
                        value={item.name}
                        onChange={(e) => patchItem(idx, "name", e.target.value)}
                        placeholder="Визитки (5000 шт)"
                      />
                    </div>
                    <div className="w-16 space-y-1">
                      {idx === 0 && (
                        <span className="text-xs text-muted-foreground">Кол-во</span>
                      )}
                      <Input
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={(e) => patchItem(idx, "qty", e.target.value)}
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      {idx === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Себест.
                        </span>
                      )}
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitCost}
                        onChange={(e) =>
                          patchItem(idx, "unitCost", e.target.value)
                        }
                        placeholder="1.6"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      {idx === 0 && (
                        <span className="text-xs text-muted-foreground">Цена</span>
                      )}
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) =>
                          patchItem(idx, "unitPrice", e.target.value)
                        }
                        placeholder="3"
                      />
                    </div>
                    <div
                      className={cn(
                        "w-24 shrink-0 pb-2 text-right text-sm",
                        lineProfit < 0 ? "text-rose-600" : "text-muted-foreground"
                      )}
                    >
                      {lineProfit ? money(lineProfit) : "—"}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0.5 shrink-0 text-rose-600"
                      disabled={items.length === 1}
                      onClick={() => setItems((r) => r.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Последняя колонка — прибыль позиции: (цена − себестоимость) × кол-во
              </p>
            </div>

            <div className="grid grid-cols-3 divide-x rounded-lg bg-muted">
              <div className="px-4 py-2.5">
                <p className="text-xs text-muted-foreground">Себестоимость</p>
                <p className="font-semibold">{money(cost)}</p>
              </div>
              <div className="px-4 py-2.5">
                <p className="text-xs text-muted-foreground">Цена продажи</p>
                <p className="font-semibold">{money(total)}</p>
              </div>
              <div className="px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Прибыль {total > 0 && `· ${margin}%`}
                </p>
                <p
                  className={cn(
                    "font-semibold",
                    profit > 0
                      ? "text-emerald-600"
                      : profit < 0
                        ? "text-rose-600"
                        : ""
                  )}
                >
                  {money(profit)}
                </p>
              </div>
            </div>

            {profit < 0 && (
              <p className="rounded-lg bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600">
                Себестоимость выше цены продажи — заказ уйдёт в убыток.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Описание</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Тип бумаги, цветность, особые требования..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
