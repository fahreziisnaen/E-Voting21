import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type {
  AdminCandidate,
  AuditLogEntry,
  AuditStatus,
  Paginated,
  ResultsResponse,
  SchoolClass,
  StatsResponse,
  Student,
} from '../types';

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Statistik agregat; diperbarui otomatis tanpa mengosongkan grafik saat memuat ulang. */
export function useStats(date?: string, live = true) {
  return useQuery({
    queryKey: ['admin', 'stats', date ?? 'today'],
    queryFn: () => api<StatsResponse>(`/admin/stats${toQuery({ date })}`),
    refetchInterval: live ? 15_000 : false,
    placeholderData: keepPreviousData,
  });
}

export function useResults() {
  return useQuery({
    queryKey: ['admin', 'results'],
    queryFn: () => api<ResultsResponse>('/admin/results'),
    refetchInterval: 30_000,
  });
}

export interface AuditLogFilters {
  page: number;
  pageSize?: number;
  action?: string;
  status?: AuditStatus | '';
  q?: string;
}

export function useAuditLogs(filters: AuditLogFilters, refetchInterval: number | false = false) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: () => api<Paginated & { logs: AuditLogEntry[] }>(`/admin/audit-logs${toQuery({ ...filters })}`),
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}

export function useAdminCandidates() {
  return useQuery({
    queryKey: ['admin', 'candidates'],
    queryFn: async () => (await api<{ candidates: AdminCandidate[] }>('/admin/candidates')).candidates,
  });
}

export interface StudentFilters {
  page: number;
  pageSize?: number;
  q?: string;
  classId?: number | '';
  gradeLevel?: '10' | '11' | '12' | 'none' | '';
  voted?: 'all' | 'yes' | 'no';
}

export function useStudents(filters: StudentFilters) {
  return useQuery({
    queryKey: ['admin', 'students', filters],
    queryFn: () =>
      api<Paginated & { students: Student[] }>(`/admin/students${toQuery({ pageSize: 25, ...filters })}`),
    placeholderData: keepPreviousData,
  });
}

export function useClasses() {
  return useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: async () => (await api<{ classes: SchoolClass[] }>('/admin/classes')).classes,
  });
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
