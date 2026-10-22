import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { HealthBadge } from '@/features/health/HealthBadge';

export function App() {
  const queryClient = useQueryClient();

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Chat</h1>
        <p className="text-sm text-muted-foreground">
          Оболонка фронтенду. Екрани з'являтимуться разом із заняттями курсу.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Стан бекенду</CardTitle>
          <CardDescription>GET /api/health через проксі Vite → Nest на :3000</CardDescription>
        </CardHeader>
        <CardContent>
          <HealthBadge />
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['health'] })}
          >
            Перевірити знову
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
