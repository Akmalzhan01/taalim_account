import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/store/auth";
import AppLayout from "@/components/layout/AppLayout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Kanban from "@/pages/Kanban";
import Tasks from "@/pages/Tasks";
import Customers from "@/pages/Customers";
import Categories from "@/pages/Categories";
import Partners from "@/pages/Partners";
import Profit from "@/pages/Profit";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";

export default function App() {
  const { user, loading, loadMe } = useAuth();

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const admin = user.role === "admin";

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/orders" element={<Kanban />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/reports" element={<Reports />} />

        {/* Партнёры, распределение прибыли и пользователи — только админ */}
        <Route
          path="/partners"
          element={admin ? <Partners /> : <Navigate to="/" replace />}
        />
        <Route
          path="/profit"
          element={admin ? <Profit /> : <Navigate to="/" replace />}
        />
        <Route
          path="/users"
          element={admin ? <Users /> : <Navigate to="/" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
