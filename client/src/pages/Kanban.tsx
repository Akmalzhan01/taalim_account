import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Plus, GripVertical, Pencil } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { money, formatDate } from "@/lib/format";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  type Order,
} from "@/lib/types";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";

import OrderDialog from "@/components/OrderDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

type Board = Record<string, Order[]>;

const COLUMN_ACCENT: Record<string, string> = {
  new: "bg-slate-400",
  design: "bg-violet-500",
  printing: "bg-blue-500",
  finishing: "bg-amber-500",
  ready: "bg-teal-500",
  delivered: "bg-emerald-500",
};

const PRIORITY_STYLE: Record<string, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-600",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  low: "border-slate-400/40 bg-slate-400/10 text-slate-600",
};

function OrderCard({
  order,
  onEdit,
  dragging,
  canWrite,
}: {
  order: Order;
  onEdit?: (o: Order) => void;
  dragging?: boolean;
  canWrite: boolean;
}) {
  const paidPct = order.totalAmount
    ? Math.min(100, Math.round((order.paidAmount / order.totalAmount) * 100))
    : 0;

  const overdue =
    order.deadline &&
    new Date(order.deadline) < new Date() &&
    order.status !== "delivered";

  return (
    <Card
      className={cn(
        "space-y-2.5 border-l-4 p-3 shadow-sm",
        dragging && "rotate-2 shadow-lg",
        order.priority === "high" ? "border-l-rose-500" : "border-l-transparent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{order.title}</p>
          <p className="text-xs text-muted-foreground">
            {order.orderNumber} · {order.customer?.name}
          </p>
        </div>
        {canWrite && onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(order)}
          >
            <Pencil className="size-3" />
          </Button>
        )}
      </div>

      {/* Себестоимость → цена → прибыль: то, ради чего заказ и берут. */}
      <div className="flex items-center justify-between rounded-md bg-muted/60 px-2 py-1.5 text-xs">
        <span className="text-muted-foreground">
          {money(order.costAmount)} → {money(order.totalAmount)}
        </span>
        <span
          className={cn(
            "font-semibold",
            order.profit > 0
              ? "text-emerald-600"
              : order.profit < 0
                ? "text-rose-600"
                : "text-muted-foreground"
          )}
        >
          {order.profit > 0 ? "+" : ""}
          {money(order.profit)}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Оплачено</span>
          <span className="font-medium">
            {money(order.paidAmount)} / {money(order.totalAmount)}
          </span>
        </div>
        <Progress value={paidPct} className="h-1.5" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn("h-5 text-[11px]", PRIORITY_STYLE[order.priority])}
        >
          {PRIORITY_LABEL[order.priority]}
        </Badge>

        {order.deadline && (
          <Badge
            variant="outline"
            className={cn(
              "h-5 gap-1 text-[11px]",
              overdue && "border-rose-500/40 bg-rose-500/10 text-rose-600"
            )}
          >
            <CalendarClock className="size-3" />
            {formatDate(order.deadline)}
          </Badge>
        )}

        {order.dueAmount > 0 && (
          <Badge variant="outline" className="h-5 text-[11px] text-amber-600">
            Долг: {money(order.dueAmount)}
          </Badge>
        )}
      </div>
    </Card>
  );
}

function SortableCard({
  order,
  onEdit,
  canWrite,
}: {
  order: Order;
  onEdit: (o: Order) => void;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: order._id, disabled: !canWrite });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      {canWrite && (
        <GripVertical className="pointer-events-none absolute -left-1 top-3.5 size-3.5 text-muted-foreground/40" />
      )}
      <OrderCard order={order} onEdit={onEdit} canWrite={canWrite} />
    </div>
  );
}

function Column({
  status,
  orders,
  onEdit,
  canWrite,
}: {
  status: string;
  orders: Order[];
  onEdit: (o: Order) => void;
  canWrite: boolean;
}) {
  // Сама колонка тоже зона сброса — чтобы можно было бросить в пустую колонку.
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const total = orders.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", COLUMN_ACCENT[status])} />
        <h3 className="text-sm font-semibold">{STATUS_LABEL[status]}</h3>
        <Badge variant="secondary" className="h-5">
          {orders.length}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {total > 0 ? money(total) : ""}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-50 flex-1 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/30"
        )}
      >
        <SortableContext
          items={orders.map((o) => o._id)}
          strategy={verticalListSortingStrategy}
        >
          {orders.map((o) => (
            <SortableCard
              key={o._id}
              order={o}
              onEdit={onEdit}
              canWrite={canWrite}
            />
          ))}
        </SortableContext>

        {orders.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Пусто — перетащите карточку сюда
          </p>
        )}
      </div>
    </div>
  );
}

export default function Kanban() {
  const qc = useQueryClient();
  const canWrite = useAuth((s) => s.canWrite());

  const [board, setBoard] = useState<Board>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);

  const { data, isLoading } = useQuery<Board>({
    queryKey: ["board"],
    queryFn: async () => (await api.get("/orders/board")).data,
  });

  // Копируем серверное состояние в локальное — при перетаскивании карточка
  // должна двигаться мгновенно, для этого нужна локальная копия.
  useEffect(() => {
    if (data) setBoard(data);
  }, [data]);

  const move = useMutation({
    mutationFn: async (v: { id: string; status: string; position: number }) =>
      api.patch(`/orders/${v.id}/move`, {
        status: v.status,
        position: v.position,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      // Если сервер отклонил перенос — возвращаемся к реальному состоянию.
      toast.error("Не удалось перенести — состояние восстановлено");
      qc.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const sensors = useSensors(
    // Перетаскивание начинается после 6px — чтобы клик по кнопке не считался драгом.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeOrder = useMemo(() => {
    if (!activeId) return null;
    for (const list of Object.values(board)) {
      const found = list.find((o) => o._id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, board]);

  const columnOf = (id: string): string | undefined => {
    if (id in board) return id;
    return Object.keys(board).find((k) => board[k].some((o) => o._id === id));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  // Как только карточка оказывается над другой колонкой, сразу переносим её
  // туда — пользователь видит, куда она упадёт.
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;

    const from = columnOf(String(active.id));
    const to = columnOf(String(over.id));
    if (!from || !to || from === to) return;

    setBoard((prev) => {
      const item = prev[from].find((o) => o._id === active.id);
      if (!item) return prev;

      const overIndex = prev[to].findIndex((o) => o._id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : prev[to].length;

      return {
        ...prev,
        [from]: prev[from].filter((o) => o._id !== active.id),
        [to]: [
          ...prev[to].slice(0, insertAt),
          { ...item, status: to as Order["status"] },
          ...prev[to].slice(insertAt),
        ],
      };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const to = columnOf(String(over.id));
    if (!to) return;

    const list = board[to];
    const oldIndex = list.findIndex((o) => o._id === active.id);
    const overIndex = list.findIndex((o) => o._id === over.id);
    const newIndex = overIndex >= 0 ? overIndex : list.length - 1;

    if (oldIndex === -1) return;

    // Изменение порядка внутри одной колонки.
    if (oldIndex !== newIndex) {
      setBoard((prev) => {
        const copy = [...prev[to]];
        const [moved] = copy.splice(oldIndex, 1);
        copy.splice(newIndex, 0, moved);
        return { ...prev, [to]: copy };
      });
    }

    move.mutate({ id: String(active.id), status: to, position: newIndex });
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (o: Order) => {
    setEditing(o);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto">
        {ORDER_STATUSES.map((s) => (
          <Skeleton key={s} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {canWrite
            ? "Перетаскивайте карточки между этапами"
            : "Состояние заказов (нет прав на изменение)"}
        </p>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Новый заказ
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ORDER_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              orders={board[status] || []}
              onEdit={openEdit}
              canWrite={canWrite}
            />
          ))}
        </div>

        <DragOverlay>
          {activeOrder && (
            <div className="w-72">
              <OrderCard order={activeOrder} dragging canWrite={canWrite} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={editing}
      />
    </div>
  );
}
