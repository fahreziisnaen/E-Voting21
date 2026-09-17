import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../lib/api';
import type { Candidate, Election, MeResponse, SessionUser, VoteReceipt } from '../types';

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<MeResponse | null> => {
    try {
      return await api<MeResponse>('/auth/me');
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

export function useCandidates() {
  return useQuery({
    queryKey: ['candidates'],
    queryFn: async () => (await api<{ candidates: Candidate[] }>('/candidates')).candidates,
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
      navigate(wasAdmin ? '/admin/login' : '/login', { replace: true });
    },
  });
}

export function useCastVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidateId: number) =>
      api<{ vote: VoteReceipt; message: string }>('/votes', { method: 'POST', body: { candidateId } }),
    onSuccess: ({ vote }) => {
      queryClient.setQueryData(meQuery.queryKey, (me) => (me ? { ...me, hasVoted: true, vote } : me));
    },
  });
}
