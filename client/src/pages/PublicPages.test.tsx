import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import { PublicLayout } from '../features/student/PublicLayout';
import type { Category, Election, MeResponse, PublicResults } from '../types';
import { CandidatesShowcasePage } from './CandidatesShowcasePage';
import { DashboardPage } from './DashboardPage';
import { ResultsPublicPage } from './ResultsPublicPage';

const categories: Category[] = [
  {
    id: 1,
    name: 'Ketua OSIS',
    description: 'Ketua OSIS periode berikutnya.',
    voterScope: 'all',
    sortOrder: 0,
    candidates: [1, 2].map((n) => ({
      id: n,
      categoryId: 1,
      categoryName: 'Ketua OSIS',
      candidateNumber: n,
      name: n === 1 ? 'Andi Pratama' : 'Siti Nurhaliza',
      role: 'student' as const,
      className: n === 1 ? 'XII IPA 1' : 'XII IPS 2',
      photoUrl: null,
      vision: n === 1 ? 'Visi Andi.' : 'Visi Siti.',
      mission: ['Misi'],
      programs: ['Program'],
      organizationHistory: [],
    })),
  },
  {
    id: 2,
    name: 'Guru Favorit',
    description: null,
    voterScope: 'student',
    sortOrder: 1,
    candidates: [
      {
        id: 3,
        categoryId: 2,
        categoryName: 'Guru Favorit',
        candidateNumber: 1,
        name: 'Dewi Lestari',
        role: 'teacher' as const,
        className: '',
        photoUrl: null,
        vision: 'Visi Dewi.',
        mission: ['Misi'],
        programs: ['Program'],
        organizationHistory: [],
      },
    ],
  },
];

const election: Election = {
  electionName: 'Pemilihan Raya 2025',
  startDate: '2025-09-12T00:00:00Z',
  endDate: '2025-09-14T08:00:00Z',
  status: 'open',
  phase: 'active',
  isVotingOpen: true,
  heroPhotoUrl: null,
  resultsPublished: false,
  resultsPublishedAt: null,
  resultsUnlocked: false,
  resultsWithheld: false,
  serverTime: '2025-09-13T03:00:00Z',
};

const student: MeResponse = {
  user: { id: 1, nis: '0021453', name: 'Ahmad Setiawan', className: 'XII IPA 2', role: 'student' },
  votes: [],
};

const teacher: MeResponse = {
  user: { id: 9, nis: 'guru.rina', name: 'Rina Wijaya', className: null, role: 'teacher' },
  votes: [],
};

const hiddenResults: PublicResults = { published: false, publishedAt: null, categories: [] };

const publishedResults: PublicResults = {
  published: true,
  publishedAt: '2025-09-14T09:00:00Z',
  categories: [
    {
      id: 1,
      name: 'Ketua OSIS',
      description: 'Ketua OSIS periode berikutnya.',
      totalVotes: 10,
      winnerIds: [2],
      tie: false,
      candidates: [
        { id: 1, candidateNumber: 1, name: 'Andi Pratama', role: 'student', className: 'XII IPA 1', photoUrl: null, votes: 4, percentage: 40 },
        { id: 2, candidateNumber: 2, name: 'Siti Nurhaliza', role: 'student', className: 'XII IPS 2', photoUrl: null, votes: 6, percentage: 60 },
      ],
    },
    {
      id: 2,
      name: 'Guru Favorit',
      description: null,
      totalVotes: 4,
      winnerIds: [3],
      tie: false,
      candidates: [{ id: 3, candidateNumber: 1, name: 'Dewi Lestari', role: 'teacher', className: '', photoUrl: null, votes: 4, percentage: 100 }],
    },
  ],
};

const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function LoginProbe() {
  const location = useLocation();
  return <pre data-testid="login-state">{JSON.stringify(location.state)}</pre>;
}

function renderPublic(me: MeResponse | null, entry: InitialEntry = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['me'], me);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <ToastProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/kandidat" element={<CandidatesShowcasePage />} />
              <Route path="/terpilih" element={<ResultsPublicPage />} />
            </Route>
            <Route path="/login" element={<LoginProbe />} />
            <Route path="/voting/berhasil" element={<p>Halaman sukses</p>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  document.cookie = 'ev_csrf=test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/categories') return json({ categories });
    if (url === '/api/election/settings') return json({ election });
    if (url === '/api/results') return json(hiddenResults);
    if (url === '/api/votes' && init?.method === 'POST') {
      return json(
        { message: 'ok', vote: { receiptCode: 'VT-2025-ABCDEFGH', votedAt: '2025-09-13T03:00:00Z', categoryId: 1, categoryName: 'Ketua OSIS' } },
        201,
      );
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
const cardOf = async (name: string) => (await screen.findByRole('heading', { name })).closest('article')!;
const categoryTab = (name: string) => within(screen.getAllByRole('group', { name: 'Pilih kategori' })[0]!).getByRole('button', { name: new RegExp(name) });

describe('beranda publik (tanpa login)', () => {
  it('menampilkan kandidat, jadwal, dan tombol masuk tanpa perlu login', async () => {
    renderPublic(null);
    expect(await screen.findByRole('heading', { name: 'Andi Pratama' })).toBeInTheDocument();
    expect(screen.getByText('12 – 14 September 2025')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tata Cara Voting' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Masuk untuk Memilih/ }).length).toBeGreaterThan(0);
    // Menu navigasi: Beranda, Kandidat, dan Terpilih.
    const nav = screen.getAllByRole('navigation', { name: 'Navigasi utama' })[0]!;
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Beranda', 'Kandidat', 'Terpilih']);
  });

  it('kandidat ditampilkan per kategori dan dapat dipindah lewat tab', async () => {
    const user = userEvent.setup();
    renderPublic(null);
    await screen.findByRole('heading', { name: 'Andi Pratama' });
    expect(screen.queryByRole('heading', { name: 'Dewi Lestari' })).not.toBeInTheDocument();

    await user.click(categoryTab('Guru Favorit'));
    expect(await screen.findByRole('heading', { name: 'Dewi Lestari' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Andi Pratama' })).not.toBeInTheDocument();
    // Kandidat guru memakai keterangan "Guru", bukan kelas.
    expect(within(await cardOf('Dewi Lestari')).getByText('Guru')).toBeInTheDocument();
  });

  it('"Pilih Kandidat" mengarahkan tamu ke login dengan niat memilih, tanpa mengirim suara', async () => {
    const user = userEvent.setup();
    renderPublic(null);
    await user.click(within(await cardOf('Siti Nurhaliza')).getByRole('button', { name: /Pilih Kandidat/ }));

    const state = JSON.parse((await screen.findByTestId('login-state')).textContent!);
    expect(state).toEqual({ from: '/', pickCandidateId: 2, pickCandidateName: 'Siti Nurhaliza (Ketua OSIS)' });
    expect(voteCalls()).toHaveLength(0);
  });

  it('tidak menampilkan perolehan suara selama pemungutan suara berlangsung', async () => {
    renderPublic(null);
    await screen.findByRole('heading', { name: 'Andi Pratama' });
    expect(screen.queryByText(/suara ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hasil resmi/)).not.toBeInTheDocument();
  });

  it('menampilkan persentase tiap kandidat dan pemenang di beranda setelah hasil terbuka', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/categories') return json({ categories });
      if (url === '/api/election/settings')
        return json({
          election: { ...election, phase: 'closed', isVotingOpen: false, resultsPublished: true, resultsUnlocked: true },
        });
      if (url === '/api/results') return json(publishedResults);
      return json({}, 404);
    });
    renderPublic(null);

    const panel = (await screen.findByRole('heading', { name: /Hasil resmi Ketua OSIS/ })).closest('section')!;
    expect(within(panel).getByText('Terpilih: Siti Nurhaliza')).toBeInTheDocument();
    expect(within(panel).getByText('6 suara · 60%')).toBeInTheDocument();
    expect(within(panel).getByText('4 suara · 40%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lihat Kandidat Terpilih' })).toBeInTheDocument();
  });

  it('detail kandidat bisa dibuka tanpa login', async () => {
    const user = userEvent.setup();
    renderPublic(null);
    await user.click(within(await cardOf('Andi Pratama')).getByRole('button', { name: /Lihat Detail/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Andi Pratama' });
    expect(within(dialog).getByText('Visi Andi.')).toBeInTheDocument();
  });
});

describe('alur memilih (sudah login)', () => {
  it('"Pilih Kandidat" hanya membuka konfirmasi — suara baru dikirim setelah "Konfirmasi Suara"', async () => {
    const user = userEvent.setup();
    renderPublic(student);
    await user.click(within(await cardOf('Andi Pratama')).getByRole('button', { name: /Pilih Kandidat/ }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Konfirmasi Pilihan Anda' });
    expect(within(dialog).getByText('Andi Pratama')).toBeInTheDocument();
    expect(within(dialog).getByText('Ketua OSIS')).toBeInTheDocument();
    expect(voteCalls()).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Konfirmasi Suara' }));
    await screen.findByText('Halaman sukses');

    expect(voteCalls()).toHaveLength(1);
    const [, init] = voteCalls()[0]!;
    expect(JSON.parse(init.body)).toEqual({ candidateId: 1 });
    expect(init.headers['X-CSRF-Token']).toBe('test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('setelah login dari tombol "Pilih Kandidat", konfirmasi kandidat tersebut langsung terbuka', async () => {
    renderPublic(student, { pathname: '/', state: { pickCandidateId: 2 } });
    const dialog = await screen.findByRole('alertdialog', { name: 'Konfirmasi Pilihan Anda' });
    expect(within(dialog).getByText('Siti Nurhaliza')).toBeInTheDocument();
    expect(voteCalls()).toHaveLength(0);
  });

  it('modal konfirmasi tertutup dengan Esc dan fokus kembali ke tombol pemicu', async () => {
    const user = userEvent.setup();
    renderPublic(student);
    const trigger = within(await cardOf('Siti Nurhaliza')).getByRole('button', { name: /Pilih Kandidat/ });
    await user.click(trigger);
    await screen.findByRole('alertdialog');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(voteCalls()).toHaveLength(0);
  });

  it('pemilih yang sudah memilih di satu kategori tetap bisa memilih di kategori lain', async () => {
    const user = userEvent.setup();
    const voted: MeResponse = {
      ...student,
      votes: [{ categoryId: 1, categoryName: 'Ketua OSIS', receiptCode: 'VT-2025-ABCDEFGH', votedAt: '2025-09-13T03:00:00Z' }],
    };
    renderPublic(voted);
    await user.click(within(await cardOf('Andi Pratama')).getByRole('button', { name: /Pilih Kandidat/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Anda sudah memberikan suara untuk kategori Ketua OSIS');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(voteCalls()).toHaveLength(0);

    await user.click(categoryTab('Guru Favorit'));
    await user.click(within(await cardOf('Dewi Lestari')).getByRole('button', { name: /Pilih Kandidat/ }));
    expect(await screen.findByRole('alertdialog', { name: 'Konfirmasi Pilihan Anda' })).toBeInTheDocument();
  });

  it('guru tidak dapat memilih di kategori khusus siswa', async () => {
    const user = userEvent.setup();
    renderPublic(teacher, '/?kategori=2');
    await user.click(within(await cardOf('Dewi Lestari')).getByRole('button', { name: /Pilih Kandidat/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Kategori Guru Favorit hanya untuk siswa');
    expect(voteCalls()).toHaveLength(0);
  });

  it('penolakan server (409) ditampilkan sebagai pesan yang mudah dipahami', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/categories') return json({ categories });
      if (url === '/api/election/settings') return json({ election });
      if (url === '/api/votes') {
        return json(
          { message: 'Anda sudah memberikan suara untuk kategori Ketua OSIS. Setiap pemilih hanya dapat memilih satu kali per kategori.', code: 'ALREADY_VOTED' },
          409,
        );
      }
      if (url === '/api/auth/me') return json({ ...student, votes: [] });
      return json({}, 404);
    });
    const user = userEvent.setup();
    renderPublic(student);
    await user.click(within(await cardOf('Andi Pratama')).getByRole('button', { name: /Pilih Kandidat/ }));
    await user.click(await screen.findByRole('button', { name: 'Konfirmasi Suara' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('satu kali per kategori');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});

describe('halaman Kandidat (slide)', () => {
  it('menampilkan profil lengkap dan bisa berpindah kandidat', async () => {
    const user = userEvent.setup();
    renderPublic(null, '/kandidat');

    const carousel = await screen.findByRole('region', { name: 'Profil kandidat Ketua OSIS' });
    expect(within(carousel).getByRole('heading', { level: 2, name: 'Andi Pratama' })).toBeInTheDocument();
    expect(within(carousel).getByText(/Kandidat 1 dari 2 · Ketua OSIS/)).toBeInTheDocument();

    await user.click(within(carousel).getByRole('button', { name: 'Kandidat berikutnya' }));
    expect(within(carousel).getByRole('heading', { level: 2, name: 'Siti Nurhaliza' })).toBeInTheDocument();
    expect(within(carousel).getByText('“Visi Siti.”', { exact: false })).toBeInTheDocument();

    // Pilihan cepat per kandidat
    await user.click(within(carousel).getByRole('button', { name: /Andi Pratama/, current: false }));
    expect(within(carousel).getByRole('heading', { level: 2, name: 'Andi Pratama' })).toBeInTheDocument();

    // Tombol jeda
    await user.click(within(carousel).getByRole('button', { name: 'Jeda slide' }));
    expect(within(carousel).getByRole('button', { name: 'Putar slide' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('slide lanjut ke kategori berikutnya setelah kandidat terakhir, lalu berputar kembali', async () => {
    const user = userEvent.setup();
    renderPublic(null, '/kandidat');
    const next = async () => {
      const carousel = await screen.findByRole('region', { name: /Profil kandidat/ });
      await user.click(within(carousel).getByRole('button', { name: 'Kandidat berikutnya' }));
    };

    await next(); // kandidat 2 Ketua OSIS
    expect(await screen.findByRole('heading', { level: 2, name: 'Siti Nurhaliza' })).toBeInTheDocument();

    await next(); // kandidat terakhir → kategori berikutnya
    const guru = await screen.findByRole('region', { name: 'Profil kandidat Guru Favorit' });
    expect(within(guru).getByRole('heading', { level: 2, name: 'Dewi Lestari' })).toBeInTheDocument();

    await next(); // kategori terakhir habis → kembali ke kandidat pertama kategori pertama
    const osis = await screen.findByRole('region', { name: 'Profil kandidat Ketua OSIS' });
    expect(within(osis).getByRole('heading', { level: 2, name: 'Andi Pratama' })).toBeInTheDocument();

    // Mundur dari kandidat pertama → kandidat terakhir kategori sebelumnya.
    await user.click(within(osis).getByRole('button', { name: 'Kandidat sebelumnya' }));
    const kembali = await screen.findByRole('region', { name: 'Profil kandidat Guru Favorit' });
    expect(within(kembali).getByRole('heading', { level: 2, name: 'Dewi Lestari' })).toBeInTheDocument();
  });

  it('tab kategori mengganti kandidat yang ditampilkan', async () => {
    const user = userEvent.setup();
    renderPublic(null, '/kandidat');
    await screen.findByRole('region', { name: 'Profil kandidat Ketua OSIS' });

    await user.click(categoryTab('Guru Favorit'));
    const carousel = await screen.findByRole('region', { name: 'Profil kandidat Guru Favorit' });
    expect(within(carousel).getByRole('heading', { level: 2, name: 'Dewi Lestari' })).toBeInTheDocument();
  });

  it('tamu yang memilih dari slide diarahkan ke login', async () => {
    const user = userEvent.setup();
    renderPublic(null, '/kandidat');
    await user.click(await screen.findByRole('button', { name: /Pilih Kandidat Ini: Andi Pratama/ }));
    const state = JSON.parse((await screen.findByTestId('login-state')).textContent!);
    expect(state).toMatchObject({ from: '/kandidat', pickCandidateId: 1 });
  });
});

describe('halaman Terpilih', () => {
  it('tidak menampilkan hasil sebelum panitia mengumumkan', async () => {
    renderPublic(null, '/terpilih');
    expect(await screen.findByRole('heading', { name: 'Hasil belum diumumkan' })).toBeInTheDocument();
    expect(screen.queryByText(/suara sah/)).not.toBeInTheDocument();
  });

  it('menampilkan pemenang setiap kategori setelah diumumkan', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/categories') return json({ categories });
      if (url === '/api/election/settings')
        return json({ election: { ...election, phase: 'closed', isVotingOpen: false, resultsPublished: true, resultsUnlocked: true } });
      if (url === '/api/results') return json(publishedResults);
      return json({}, 404);
    });
    renderPublic(null, '/terpilih');

    const osis = (await screen.findByRole('heading', { name: 'Ketua OSIS' })).closest('section')!;
    expect(within(osis).getByRole('heading', { level: 3, name: 'Siti Nurhaliza' })).toBeInTheDocument();
    expect(within(osis).getByText('Terpilih')).toBeInTheDocument();
    expect(within(osis).getByText('10 suara sah')).toBeInTheDocument();
    // Perolehan seluruh kandidat ditulis sebagai angka, bukan hanya batang warna.
    expect(within(osis).getByText('4 suara · 40%')).toBeInTheDocument();

    const guru = (await screen.findByRole('heading', { name: 'Guru Favorit' })).closest('section')!;
    expect(within(guru).getByRole('heading', { level: 3, name: 'Dewi Lestari' })).toBeInTheDocument();
  });
});
