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
import { CalendarClock, Plus, GripVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatDate, toInputDate } from "@/lib/format";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  PRIORITY_LABEL,
  type Priority,
  type Task,
} from "@/lib/types";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

type Board = Record<string, Task[]>;

const COLUMN_ACCENT: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
};

const PRIORITY_STYLE: Record<string, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-600",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  low: "border-slate-400/40 bg-slate-400/10 text-slate-600",
};

function TaskCard({
  task,
  onEdit,
  onDelete,
  dragging,
  canWrite,
}: {
  task: Task;
  onEdit?: (t: Task) => void;
  onDelete?: (t: Task) => void;
  dragging?: boolean;
  canWrite: boolean;
}) {
  const overdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date(new Date().toDateString()) &&
    task.status !== "done";

  return (
    <Card
      className={cn(
        "space-y-2 p-3 shadow-sm",
        dragging && "rotate-2 shadow-lg",
        task.status === "done" && "opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "min-w-0 text-sm font-medium",
            task.status === "done" && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>
        {canWrite && (onEdit || onDelete) && (
          <div className="flex shrink-0 gap-0.5">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onEdit(task)}
              >
                <Pencil className="size-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-rose-600"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onDelete(task)}
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn("h-5 text-[11px]", PRIORITY_STYLE[task.priority])}
        >
          {PRIORITY_LABEL[task.priority]}
        </Badge>

        {task.dueDate && (
          <Badge
            variant="outline"
            className={cn(
              "h-5 gap-1 text-[11px]",
              overdue && "border-rose-500/40 bg-rose-500/10 text-rose-600"
            )}
          >
            <CalendarClock className="size-3" />
            {formatDate(task.dueDate)}
          </Badge>
        )}
      </div>
    </Card>
  );
}

function SortableCard({
  task,
  onEdit,
  onDelete,
  canWrite,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task._id, disabled: !canWrite });

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
      <TaskCard
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        canWrite={canWrite}
      />
    </div>
  );
}

function Column({
  status,
  tasks,
  onEdit,
  onDelete,
  canWrite,
}: {
  status: string;
  tasks: Task[];
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  canWrite: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", COLUMN_ACCENT[status])} />
        <h3 className="text-sm font-semibold">{TASK_STATUS_LABEL[status]}</h3>
        <Badge variant="secondary" className="h-5">
          {tasks.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-50 flex-1 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/30"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t._id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((t) => (
            <SortableCard
              key={t._id}
              task={t}
              onEdit={onEdit}
              onDelete={onDelete}
              canWrite={canWrite}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {canWrite ? "Пусто — перетащите задачу сюда" : "Пусто"}
          </p>
        )}
      </div>
    </div>
  );
}

const emptyForm = {
  title: "",
  description: "",
  priority: "medium" as Priority,
  dueDate: "",
};

export default function Tasks() {
  const qc = useQueryClient();
  const canWrite = useAuth((s) => s.canWrite());

  const [board, setBoard] = useState<Board>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery<Board>({
    queryKey: ["tasks-board"],
    queryFn: async () => (await api.get("/tasks/board")).data,
  });

  // Локальная копия — карточка должна двигаться мгновенно при перетаскивании.
  useEffect(() => {
    if (data) setBoard(data);
  }, [data]);

  const move = useMutation({
    mutationFn: async (v: { id: string; status: string; position: number }) =>
      api.patch(`/tasks/${v.id}/move`, { status: v.status, position: v.position }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks-board"] }),
    onError: () => {
      toast.error("Не удалось перенести — состояние восстановлено");
      qc.invalidateQueries({ queryKey: ["tasks-board"] });
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      editing
        ? (await api.patch(`/tasks/${editing._id}`, payload)).data
        : (await api.post("/tasks", payload)).data,
    onSuccess: () => {
      toast.success(editing ? "Задача обновлена" : "Задача добавлена");
      qc.invalidateQueries({ queryKey: ["tasks-board"] });
      setOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: ["tasks-board"] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const list of Object.values(board)) {
      const found = list.find((t) => t._id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, board]);

  const columnOf = (id: string): string | undefined => {
    if (id in board) return id;
    return Object.keys(board).find((k) => board[k].some((t) => t._id === id));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;

    const from = columnOf(String(active.id));
    const to = columnOf(String(over.id));
    if (!from || !to || from === to) return;

    setBoard((prev) => {
      const item = prev[from].find((t) => t._id === active.id);
      if (!item) return prev;

      const overIndex = prev[to].findIndex((t) => t._id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : prev[to].length;

      return {
        ...prev,
        [from]: prev[from].filter((t) => t._id !== active.id),
        [to]: [
          ...prev[to].slice(0, insertAt),
          { ...item, status: to as Task["status"] },
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
    const oldIndex = list.findIndex((t) => t._id === active.id);
    const overIndex = list.findIndex((t) => t._id === over.id);
    const newIndex = overIndex >= 0 ? overIndex : list.length - 1;

    if (oldIndex === -1) return;

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
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || "",
      priority: t.priority,
      dueDate: t.dueDate ? toInputDate(t.dueDate) : "",
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      title: form.title,
      description: form.description,
      priority: form.priority,
      dueDate: form.dueDate || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto">
        {TASK_STATUSES.map((s) => (
          <Skeleton key={s} className="h-96 w-80 shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {canWrite
            ? "Повседневные дела команды — перетаскивайте карточки между колонками"
            : "Повседневные дела команды (нет прав на изменение)"}
        </p>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Новая задача
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
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={board[status] || []}
              onEdit={openEdit}
              onDelete={(t) => remove.mutate(t._id)}
              canWrite={canWrite}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="w-80">
              <TaskCard task={activeTask} dragging canWrite={canWrite} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактирование задачи" : "Новая задача"}
            </DialogTitle>
            <DialogDescription>
              Простая заметка о деле: что сделать, насколько срочно и до какого
              числа.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Что нужно сделать *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Купить бумагу А4"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Приоритет</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, priority: v as Priority }))
                  }
                >
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
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Описание</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={2}
                placeholder="Детали, ссылки, кого касается..."
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
