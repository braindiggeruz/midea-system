import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const DEFAULT_RETURN_TO = "/";

function getReturnTo() {
  if (typeof window === "undefined") return DEFAULT_RETURN_TO;
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");

  if (!returnTo || !returnTo.startsWith("/")) {
    return DEFAULT_RETURN_TO;
  }

  return returnTo;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading, refresh } = useAuth();
  const returnTo = useMemo(() => getReturnTo(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Вход выполнен");
      setLocation(returnTo);
    },
    onError: (error) => {
      toast.error(error.message || "Не удалось выполнить вход");
    },
  });

  useEffect(() => {
    if (!loading && user) {
      setLocation(returnTo);
    }
  }, [loading, returnTo, setLocation, user]);

  const canSubmit = email.trim().length > 3 && password.trim().length >= 8;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || loginMutation.isPending) return;

    await loginMutation.mutateAsync({
      email: email.trim(),
      password,
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-6 py-12 text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.16),_transparent_28%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="hidden rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-[0_40px_120px_-48px_rgba(56,189,248,0.45)] backdrop-blur-xl lg:block">
            <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.32em] text-primary">
              Railway standalone mode
            </div>
            <div className="mt-8 space-y-5">
              <h1 className="max-w-xl text-5xl font-semibold leading-tight tracking-tight">
                Midea Digital Contour теперь работает как самостоятельная админ-платформа.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Вход больше не зависит от внешнего провайдера. Используйте локальную пару email и пароль, чтобы открыть CRM-контур,
                автоматизации, Telegram-операции и безопасный runtime для Railway.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-background/50 p-5">
                <p className="text-sm font-medium text-foreground">Standalone cookie session</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Сессия хранится локально и отправляется вместе с запросами, что упрощает перенос на Railway и custom domain.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/50 p-5">
                <p className="text-sm font-medium text-foreground">Bootstrap admin</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Первый администратор поднимается через переменные окружения, без внешнего OAuth-провайдера и без привязки к сторонней identity-платформе.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-card/85 p-8 shadow-[0_32px_120px_-52px_rgba(14,165,233,0.5)] backdrop-blur-xl sm:p-10">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-primary">
                Secure access
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-card-foreground">Войти в админ-панель</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Используйте локальный аккаунт администратора или менеджера. После входа вы вернётесь на исходную страницу панели.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-card-foreground">
                  Email
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@your-domain.com"
                    className="h-6 w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-card-foreground">
                  Пароль
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                  <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Минимум 8 символов"
                    className="h-6 w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={!canSubmit || loginMutation.isPending}>
                {loginMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Проверяем доступ
                  </span>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>

            <div className="mt-6 rounded-2xl border border-border/60 bg-background/50 p-4 text-sm leading-6 text-muted-foreground">
              Если это первый запуск на Railway, создайте bootstrap admin через переменные окружения
              <span className="font-medium text-foreground"> STANDALONE_ADMIN_EMAIL </span>
              и
              <span className="font-medium text-foreground"> STANDALONE_ADMIN_PASSWORD</span>.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
