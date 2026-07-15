export type Role = "admin" | "accountant" | "viewer";
export type TxType = "income" | "expense";
export type PaymentMethod = "cash" | "card" | "bank" | "invoice";

export const ORDER_STATUSES = [
  "new",
  "design",
  "printing",
  "finishing",
  "ready",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number] | "cancelled";
export type Priority = "low" | "medium" | "high";

export const STATUS_LABEL: Record<string, string> = {
  new: "Новый",
  design: "Дизайн",
  printing: "Печать",
  finishing: "Постпечать",
  ready: "Готов",
  delivered: "Выдан",
  cancelled: "Отменён",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "Сделать",
  in_progress: "В работе",
  done: "Готово",
};

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  position: number;
  completedAt?: string | null;
  createdAt: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Администратор",
  accountant: "Бухгалтер",
  viewer: "Наблюдатель",
};

export const TYPE_LABEL: Record<TxType, string> = {
  income: "Приход",
  expense: "Расход",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  bank: "Банковский перевод",
  invoice: "По счёту",
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
}

export interface Category {
  _id: string;
  name: string;
  type: TxType;
  color: string;
  isActive: boolean;
}

export interface Customer {
  _id: string;
  name: string;
  phone?: string;
  company?: string;
  address?: string;
  note?: string;
  isActive: boolean;
  orderCount?: number;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
}

export interface OrderItem {
  name: string;
  qty: number;
  /** Себестоимость единицы */
  unitCost: number;
  /** Цена продажи единицы */
  unitPrice: number;
  cost: number;
  amount: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: Customer;
  title: string;
  description?: string;
  items: OrderItem[];
  /** Цена продажи */
  totalAmount: number;
  /** Себестоимость */
  costAmount: number;
  /** Фактически получено от клиента */
  paidAmount: number;
  /** Фактически потрачено (транзакции, привязанные к заказу) */
  expenseAmount: number;
  dueAmount: number;
  /** totalAmount − costAmount */
  profit: number;
  marginPercent: number;
  status: OrderStatus;
  deliveredAt?: string | null;
  position: number;
  priority: Priority;
  deadline?: string;
  createdAt: string;
}

export interface Transaction {
  _id: string;
  type: TxType;
  amount: number;
  date: string;
  category: Category;
  order?: { _id: string; orderNumber: string; title: string };
  customer?: { _id: string; name: string };
  description?: string;
  paymentMethod: PaymentMethod;
}

export interface Partner {
  _id: string;
  name: string;
  phone?: string;
  sharePercent: number;
  isActive: boolean;
  note?: string;
  totalEarned: number;
  totalPaid: number;
  balance: number;
}

export interface Share {
  partner: string;
  partnerName: string;
  percent: number;
  amount: number;
  paidAmount: number;
}

/** Расчёт прибыли месяца: выручка − себестоимость + прочий доход − накладные. */
export interface ProfitBreakdown {
  revenue: number;
  cogs: number;
  grossProfit: number;
  otherIncome: number;
  overhead: number;
  netProfit: number;
  orderCount: number;
}

/** Дележ распределяемой суммы: партнёрам по долям, остальное владельцу. */
export interface OwnerSplit {
  /** Доля владельца в процентах — всё, что не роздано партнёрам */
  ownerPercent: number;
  ownerAmount: number;
}

export interface Distribution extends ProfitBreakdown, OwnerSplit {
  _id: string;
  year: number;
  month: number;
  reinvestPercent: number;
  reinvestAmount: number;
  distributable: number;
  shares: Share[];
  status: "draft" | "approved" | "paid";
  totalPaid: number;
  totalUnpaid: number;
  note?: string;
  createdAt: string;
}

/** Заказ в расшифровке прибыли — что именно дало прибыль в этом месяце. */
export interface ProfitOrder {
  _id: string;
  orderNumber: string;
  title: string;
  customerName: string;
  totalAmount: number;
  costAmount: number;
  profit: number;
  marginPercent: number;
  deliveredAt: string;
}

export interface DistributionPreview extends ProfitBreakdown, OwnerSplit {
  year: number;
  month: number;
  reinvestPercent: number;
  reinvestAmount: number;
  distributable: number;
  shares: Omit<Share, "paidAmount">[];
  partnersAmount: number;
  /** Сумма долей партнёров в процентах (без владельца) */
  shareTotal: number;
  /** false, только если партнёрам роздано больше 100% */
  shareValid: boolean;
  isLoss: boolean;
  existingId: string | null;
  /** Выданные за месяц заказы */
  orders: ProfitOrder[];
  /** Транзакции без привязки к заказу — они и есть накладные / прочий доход */
  overheadItems: Transaction[];
}

export interface Dashboard {
  period: { year: number; month: number };
  kpi: ProfitBreakdown &
    OwnerSplit & {
      prevRevenue: number;
      prevNetProfit: number;
      shares: Omit<Share, "paidAmount">[];
      partnersAmount: number;
      shareTotal: number;
      shareValid: boolean;
      /** Прибыль заказов, ещё не выданных клиенту */
      pipelineProfit: number;
      cash: number;
      receivable: number;
      customers: number;
      activeOrders: number;
    };
  ordersByStatus: Record<string, number>;
  monthly: {
    label: string;
    year: number;
    month: number;
    revenue: number;
    cost: number;
    profit: number;
  }[];
  topExpense: { name: string; color: string; total: number }[];
  recent: Transaction[];
}
