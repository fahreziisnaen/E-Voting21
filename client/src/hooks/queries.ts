import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../lib/api';
import type { CastVote, Category, Election, MeResponse, PublicResults, SessionUser } from '../types';

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<MeResponse | null> => {
    try {
      // Pengunjung tanpa sesi mendapat { user: null } — beranda bersifat publik.
      const me = await api<MeResponse | { user: null; votes: [] }>('/auth/me');
      return me.user ? (me as MeResponse) : null;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
  staleTime: 30_000,
});

/** Status voting selalu dari server (`/auth/me`), tidak pernah dari localStorage. */
export function useMe() {
  return useQuery(meQuery);
}

export function useElection() {
  return useQuery({
    queryKey: ['election'],
    queryFn: async () => (await api<{ election: Election }>('/election/settings')).election,
    refetchInterval: 60_000,
  });
}

/** Kategori beserta kandidatnya — publik, tanpa login. */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api<{ categories: Category[] }>('/categories')).categories,
  });
}

/** Kandidat terpilih per kategori; kosong sampai panitia mengumumkan hasil. */
export function usePublicResults() {
  return useQuery({
    queryKey: ['results'],
    queryFn: () => api<PublicResults>('/results'),
    refetchInterval: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nis: string; password: string }) =>
      api<{ user: SessionUser }>('/auth/login', { method: 'POST', body: input }),
    onSuccess: async () => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
      await queryClient.fetchQuery({ ...meQuery, staleTime: 0 });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }).catch(() => undefined),
    onSettled: (_data, _error, _vars) => {
      const wasAdmin = queryClient.getQueryData(meQuery.queryKey)?.user.role === 'admin';
      queryClient.setQueryData(meQuery.queryKey, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
      navigate(wasAdmin ? '/admin/login' : '/', { replace: true });
    },
  });
}

export function useCastVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: number) =>
      api<{ vote: CastVote; message: string }>('/votes', { method: 'POST', body: { candidateId } }),
    onSuccess: ({ vote }) => {
      queryClient.setQueryData(meQuery.queryKey, (me) =>
        me ? { ...me, votes: [...me.votes.filter((v) => v.categoryId !== vote.categoryId), vote] } : me,
      );
    },
  });
}
