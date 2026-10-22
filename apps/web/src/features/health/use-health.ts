import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';

/** Відповідь GET /api/health (контракт L01). */
export interface HealthResponse {
  status: string;
  version: string;
  checks: Record<string, unknown>;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health'),
    retry: false,
    refetchInterval: 10_000,
  });
}
