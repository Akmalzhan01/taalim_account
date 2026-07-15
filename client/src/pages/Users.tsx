import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL, type Role, type User } from "@/lib/types";
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

const ROLE_HINT: Record<Role, string> = {
  admin: "Всё: партнёры, распределение прибыли, пользователи",
  accountant: "Приход-расход, заказы, клиенты, категории",
  viewer: "Только просмотр — ничего изменить не может",
};

const empty = { name: "", email: "", password: "", role: "viewer" as Role };

export default function Users() {
  const qc = useQueryClient();
  const me = useAuth((s) => s.user);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/auth/register", form)).data,
    onSuccess: () => {
      toast.success("Пользователь добавлен");
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const patch = useMutation({
    mutationFn: async (v: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/users/${v.id}`, v.body),
    onSuccess: () => {
      toast.success("Обновлено");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Роль определяет, что пользователь может делать
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Новый пользователь
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Добавлен</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isSelf = u.id === me?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <p className="font-medium">
                            {u.name}
                            {isSelf && (
                              <Badge
                                variant="secondary"
                                className="ml-2 h-5 text-[11px]"
                              >
                                Вы
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </TableCell>

                        <TableCell>
                          {/* Менять свою роль сервер тоже не позволит. */}
                          <Select
                            value={u.role}
                            disabled={isSelf}
                            onValueChange={(v) =>
                              patch.mutate({ id: u.id, body: { role: v } })
                            }
                          >
                            <SelectTrigger className="w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABEL[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        <TableCell>
                          <Button
                            variant={u.isActive ? "outline" : "secondary"}
                            size="sm"
                            disabled={isSelf}
                            onClick={() =>
                              patch.mutate({
                                id: u.id,
                                body: { isActive: !u.isActive },
                              })
                            }
                          >
                            {u.isActive ? "Активен" : "Заблокирован"}
                          </Button>
                        </TableCell>

                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(u.createdAt)}
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-rose-600"
                            disabled={isSelf}
                            onClick={() => remove.mutate(u.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый пользователь</DialogTitle>
            <DialogDescription>{ROLE_HINT[form.role]}</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Имя</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Пароль</Label>
              <Input
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Роль</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={create.isPending}>
                Добавить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
