import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import type { Candidate, Election, MeResponse } from '../types';
import { DashboardPage } from './DashboardPage';

const candidates: Candidate[] = [1, 2].map((n) => ({
  id: n,
  candidateNumber: n,
  name: n === 1 ? 'Andi Pratama' : 'Siti Nurhaliza',
  className: 'XII IPA 1',
  photoUrl: null,
  vision: 'Visi kandidat.',
  mission: ['Misi'],
  programs: ['Program'],
  organizationHistory: [],
}));

const election: Election = {
  electionName: 'Pemilihan Ketua OSIS 2025',
  startDate: '2025-09-12T00:00:00Z',
  endDate: '2025-09-14T08:00:00Z',
  status: 'open',
  phase: 'active',
  isVotingOpen: true,
  heroPhotoUrl: null,
  serverTime: '2025-09-13T03:00:00Z',
};

let me: MeResponse;
const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['me'], me);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/voting/berhasil" element={<p>Halaman sukses</p>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  me = {
    user: { id: 1, nis: '0021453', name: 'Ahmad Setiawan', className: 'XII IPA 2', role: 'student' },
    hasVoted: false,
    vote: null,
  };
  document.cookie = 'ev_csrf=test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/candidates') return json({ candidates });
    if (url === '/api/election/settings') return json({ election });
    if (url === '/api/votes' && init?.method === 'POST') {
      return json({ message: 'ok', vote: { receiptCode: 'VT-2025-ABCDEFGH', votedAt: '2025-09-13T03:00:00Z' } }, 201);
    }
    return json({ message: 'tidak ditemukan' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const voteCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/votes');

describe('alur memilih', () => {
  it('"Pilih Kandidat" hanya membuka konfirmasi — suara baru dikirim setelah "Konfirmasi Suara"', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const card = (await screen.findByRole('heading', { name: 'Andi Pratama' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: /Pilih Kandidat/ }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Konfirmasi Pilihan Anda' });
    expect(within(dialog).getByText('Andi Pratama')).toBeInTheDocument();
    expect(voteCalls()).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Konfirmasi Suara' }));
    await screen.findByText('Halaman sukses');

    expect(voteCalls()).toHaveLength(1);
    const [, init] = voteCalls()[0]!;
    expect(JSON.parse(init.body)).toEqual({ candidateId: 1 });
    expect(init.headers['X-CSRF-Token']).toBe('test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('modal konfirmasi tertutup dengan Esc dan fokus kembali ke tombol pemicu', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const card = (await screen.findByRole('heading', { name: 'Siti Nurhaliza' })).closest('article')!;
    const trigger = within(card).getByRole('button', { name: /Pilih Kandidat/ });
    await user.click(trigger);
    await screen.findByRole('alertdialog');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(voteCalls()).toHaveLength(0);
  });

  it('siswa yang sudah memilih mendapat notifikasi, bukan modal', async () => {
    me = { ...me, hasVoted: true, vote: { receiptCode: 'VT-2025-ABCDEFGH', votedAt: '2025-09-13T03:00:00Z' } };
    const user = userEvent.setup();
    renderDashboard();

    const card = (await screen.findByRole('heading', { name: 'Andi Pratama' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: /Pilih Kandidat/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Anda sudah memberikan suara');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(voteCalls()).toHaveLength(0);
  });

  it('penolakan server (409) ditampilkan sebagai pesan yang mudah dipahami', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/candidates') return json({ candidates });
      if (url === '/api/election/settings') return json({ election });
      if (url === '/api/votes') return json({ message: 'Anda sudah memberikan suara. Setiap siswa hanya dapat memilih satu kali.', code: 'ALREADY_VOTED' }, 409);
      if (url === '/api/auth/me') return json({ ...me, hasVoted: true });
      return json({}, 404);
    });
    const user = userEvent.setup();
    renderDashboard();

    const card = (await screen.findByRole('heading', { name: 'Andi Pratama' })).closest('article')!;
    await user.click(within(card).getByRole('button', { name: /Pilih Kandidat/ }));
    await user.click(await screen.findByRole('button', { name: 'Konfirmasi Suara' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('hanya dapat memilih satu kali');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});
