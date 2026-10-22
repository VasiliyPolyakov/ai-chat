import { ApiError } from '@/api/client';
import { cn } from '@/lib/utils';
import { useHealth } from './use-health';

type Tone = 'ok' | 'warn' | 'down' | 'pending';

const toneClass: Record<Tone, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  down: 'bg-destructive',
  pending: 'bg-muted-foreground animate-pulse',
};

function describe(state: ReturnType<typeof useHealth>): {
  tone: Tone;
  label: string;
  hint?: string;
} {
  if (state.isPending) return { tone: 'pending', label: 'Перевіряю API…' };
  if (state.isSuccess) {
    const { status, version } = state.data;
    return {
      tone: status === 'ok' ? 'ok' : 'warn',
      label: `API: ${status}`,
      hint: `версія ${version}`,
    };
  }
  const error = state.error;
  if (error instanceof ApiError && error.status === 404) {
    return {
      tone: 'warn',
      label: 'API працює, але /api/health ще немає',
      hint: 'це завдання L01.S1',
    };
  }
  if (error instanceof ApiError && error.status >= 500) {
    return {
      tone: 'down',
      label: 'API недоступне',
      hint: `проксі повернув ${error.status} — api не стартував?`,
    };
  }
  return { tone: 'down', label: 'API недоступне', hint: error?.message };
}

export function HealthBadge() {
  const health = useHealth();
  const { tone, label, hint } = describe(health);

  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <span className={cn('inline-block size-2.5 rounded-full', toneClass[tone])} aria-hidden />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
