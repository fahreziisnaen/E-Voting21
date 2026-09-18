export type Role = 'student' | 'teacher' | 'admin';
export type VoterRole = Exclude<Role, 'admin'>;
/** Siapa yang boleh memilih di sebuah kategori. */
export type VoterScope = 'all' | VoterRole;

export interface SessionUser {
  id: number;
  nis: string;
  name: string;
  /** null untuk guru & panitia. */
  className: string | null;
  role: Role;
}

/** Tanda terima suara per kategori (tidak memuat kandidat pilihan). */
export interface CastVote {
  categoryId: number;
  categoryName: string;
  receiptCode: string;
  votedAt: string;
}

export interface MeResponse {
  user: SessionUser;
  votes: CastVote[];
}

export interface Candidate {
  id: number;
  categoryId: number;
  categoryName: string;
  candidateNumber: number;
  name: string;
  role: VoterRole;
  /** Kosong untuk guru. */
  className: string;
  photoUrl: string | null;
  vision: string;
  mission: string[];
  programs: string[];
  organizationHistory: string[];
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  voterScope: VoterScope;
  sortOrder: number;
  candidates: Candidate[];
}

export type ElectionStatus = 'draft' | 'open' | 'closed';
export type ElectionPhase = 'draft' | 'upcoming' | 'active' | 'outside_hours' | 'ended' | 'closed';

export interface Election {
  electionName: string;
  startDate: string;
  endDate: string;
  status: ElectionStatus;
  phase: ElectionPhase;
  isVotingOpen: boolean;
  heroPhotoUrl: string | null;
  /** Hasil dapat dilihat publik di menu "Terpilih". */
  resultsPublished: boolean;
  resultsPublishedAt: string | null;
  /** Syarat pengumuman sudah terpenuhi: voting selesai/ditutup atau semua pemilih sudah memilih. */
  resultsUnlocked: boolean;
  /** Panitia menahan pengumuman meski syaratnya terpenuhi. */
  resultsWithheld: boolean;
  serverTime: string;
}

export interface CandidateResult {
  id: number;
  candidateNumber: number;
  name: string;
  role: VoterRole;
  className: string;
  photoUrl: string | null;
  votes: number;
  percentage: number;
}

export interface CategoryResult {
  id: number;
  name: string;
  description: string | null;
  totalVotes: number;
  candidates: CandidateResult[];
  /** Lebih dari satu = seri. Kosong bila belum ada suara. */
  winnerIds: number[];
  tie: boolean;
}

export interface PublicResults {
  published: boolean;
  publishedAt: string | null;
  categories: CategoryResult[];
}

// ── Panel panitia ──────────────────────────────────────────────────────────

export interface AdminCategoryResult extends CategoryResult {
  voterScope: VoterScope;
  /** Jumlah pemilih yang berhak memilih di kategori ini. */
  eligible: number;
  turnout: number;
}

export interface ResultTotals {
  students: number;
  teachers: number;
  voters: number;
  /** Pemilih yang sudah memilih di minimal satu kategori. */
  participated: number;
  notParticipated: number;
  turnout: number;
  totalVotes: number;
  /** Jumlah suara bila semua pemilih memilih di semua kategori haknya. */
  expectedVotes: number;
  /** Semua pemilih sudah memilih di semua kategori — syarat hasil terbuka otomatis. */
  completed: boolean;
}

export interface ResultsResponse {
  totals: ResultTotals;
  categories: AdminCategoryResult[];
  generatedAt: string;
}

export interface StatsResponse extends ResultsResponse {
  date: string;
  perHour: Array<{ hour: number; count: number }>;
}

export type AuditStatus = 'success' | 'rejected' | 'failed';

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  action: string;
  actor: string | null;
  status: AuditStatus;
  metadata: Record<string, unknown> | null;
}

export interface Paginated {
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminCategory {
  id: number;
  name: string;
  description: string | null;
  voterScope: VoterScope;
  sortOrder: number;
  candidateCount: number;
  voteCount: number;
}

export interface AdminCandidate extends Candidate {
  userId: number;
  nis: string;
  classId: number | null;
  hasVotes: boolean;
}

export type GradeLevel = 10 | 11 | 12;

export interface SchoolClass {
  id: number;
  name: string;
  gradeLevel: GradeLevel | null;
  studentCount: number;
  votedCount: number;
}

export interface ImportResult {
  received: number;
  created: number;
  skipped: number;
  createdNis: string[];
  createdClasses: string[];
}

/** Siswa atau guru di panel panitia. */
export interface Voter {
  id: number;
  nis: string;
  name: string;
  classId: number | null;
  className: string | null;
  gradeLevel: GradeLevel | null;
  /** Jumlah kategori yang sudah dipilih (tanpa isi pilihannya). */
  votedCount: number;
  candidacies: Array<{ categoryId: number; categoryName: string; candidateNumber: number }>;
  createdAt: string;
}
