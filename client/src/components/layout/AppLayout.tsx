import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowRightLeft,
  KanbanSquare,
  ListTodo,
  Users2,
  Tags,
  Handshake,
  PieChart,
  FileBarChart,
  Shield,
  LogOut,
  Menu,
  X,
  Printer,
} from "lucide-react";

import { useAuth } from "@/store/auth";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { to: "/", label: "Панель управления", icon: LayoutDashboard, exact: true },
  { to: "/transactions", label: "Приход-расход", icon: ArrowRightLeft },
  { to: "/orders", label: "Заказы (канбан)", icon: KanbanSquare },
  { to: "/tasks", label: "Задачи", icon: ListTodo },
  { to: "/customers", label: "Клиенты", icon: Users2 },
  { to: "/categories", label: "Категории", icon: Tags },
  { to: "/reports", label: "Отчёты", icon: FileBarChart },
  { to: "/partners", label: "Партнёры", icon: Handshake, adminOnly: true },
  { to: "/profit", label: "Распределение прибыли", icon: PieChart, adminOnly: true },
  { to: "/users", label: "Пользователи", icon: Shield, adminOnly: true },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const items = NAV.filter((n) => !n.adminOnly || user?.role === "admin");

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Подложка под мобильным меню */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Printer className="size-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Полиграф Учёт</div>
              <div className="text-xs text-muted-foreground">
                Партнёрская система
              </div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user?.name}</div>
              <Badge variant="secondary" className="mt-0.5 h-5 text-[11px]">
                {ROLE_LABEL[user!.role]}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Выйти">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {items.find((i) =>
              i.exact
                ? location.pathname === i.to
                : location.pathname.startsWith(i.to)
            )?.label || "Полиграф Учёт"}
          </h1>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
