import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type {
  AdminCandidate,
  AdminCategory,
  AuditLogEntry,
  AuditStatus,
  Paginated,
  ResultsResponse,
  SchoolClass,
  StatsResponse,
  Voter,
  VoterRole,
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

export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => (await api<{ categories: AdminCategory[] }>('/admin/categories')).categories,
  });
}

export function useAdminCandidates() {
  return useQuery({
    queryKey: ['admin', 'candidates'],
    queryFn: async () => (await api<{ candidates: AdminCandidate[] }>('/admin/candidates')).candidates,
  });
}

export interface VoterFilters {
  page: number;
  pageSize?: number;
  q?: string;
  /** Hanya untuk siswa. */
  classId?: number | '';
  gradeLevel?: '10' | '11' | '12' | 'none' | '';
  voted?: 'all' | 'yes' | 'no';
}

export interface VotersResponse extends Paginated {
  voters: Voter[];
  /** Jumlah kategori yang boleh dipilih oleh peran ini. */
  eligibleCategories: number;
}

/** Endpoint siswa & guru untuk panitia: /admin/students atau /admin/teachers. */
export const VOTER_ENDPOINT: Record<VoterRole, string> = { student: '/admin/students', teacher: '/admin/teachers' };

export function useVoters(role: VoterRole, filters: VoterFilters, enabled = true) {
  return useQuery({
    queryKey: ['admin', role === 'student' ? 'students' : 'teachers', filters],
    queryFn: () => api<VotersResponse>(`${VOTER_ENDPOINT[role]}${toQuery({ pageSize: 25, ...filters })}`),
    placeholderData: keepPreviousData,
    enabled,
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
