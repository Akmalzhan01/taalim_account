import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "green" | "red" | "blue" | "amber" | "slate";
  /** Изменение к прошлому периоду, %. null — не с чем сравнивать. */
  delta?: number | null;
  hint?: string;
}

const TONES = {
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  delta,
  hint,
}: Props) {
  const up = (delta ?? 0) >= 0;

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>

          {delta != null && (
            <p
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                up ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {up ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {up ? "+" : ""}
              {delta}% к прошлому месяцу
            </p>
          )}
          {delta == null && hint && (
            <p className="text-xs text-muted-foreground">{hint}</p>
          )}
        </div>

        <div className={cn("rounded-lg p-2.5", TONES[tone])}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
