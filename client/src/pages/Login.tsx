import { useState } from "react";
import { Loader2, Printer } from "lucide-react";

import { useAuth } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      // Сообщение об ошибке показывает интерцептор api в виде тоста.
    } finally {
      setLoading(false);
    }
  };

  const fill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Printer className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Полиграф Учёт</h1>
            <p className="text-sm text-muted-foreground">
              Учёт финансов и партнёрских долей
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Вход в систему</CardTitle>
            <CardDescription>Введите email и пароль</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@poligraf.kg"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="space-y-2 pt-6 text-sm">
            <p className="font-medium">Демо-доступы (нажмите, чтобы подставить):</p>
            {[
              ["admin@poligraf.kg", "admin123", "Администратор"],
              ["buh@poligraf.kg", "buh123", "Бухгалтер"],
              ["viewer@poligraf.kg", "viewer123", "Наблюдатель"],
            ].map(([e, p, role]) => (
              <button
                key={e}
                type="button"
                onClick={() => fill(e, p)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-background"
              >
                <span className="font-mono">{e}</span>
                <span className="text-muted-foreground">{role}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
