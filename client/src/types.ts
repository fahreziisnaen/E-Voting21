export type Role = 'student' | 'admin';

export interface SessionUser {
  id: number;
  nis: string;
  name: string;
  /** null untuk akun panitia. */
  className: string | null;
  role: Role;
}

export interface VoteReceipt {
  receiptCode: string;
  votedAt: string;
}

export interface MeResponse {
  user: SessionUser;
  hasVoted: boolean;
  vote: VoteReceipt | null;
}

export interface Candidate {
  id: number;
  candidateNumber: number;
  name: string;
  className: string;
  photoUrl: string | null;
  vision: string;
  mission: string[];
  programs: string[];
  organizationHistory: string[];
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
  serverTime: string;
}

// ── Panel panitia ──────────────────────────────────────────────────────────

export interface CandidateResult {
  id: number;
  candidateNumber: number;
  name: string;
  className: string;
  photoUrl: string | null;
  votes: number;
  percentage: number;
}

export interface ResultTotals {
  students: number;
  voted: number;
  notVoted: number;
  turnout: number;
  totalVotes: number;
}

export interface ResultsResponse {
  totals: ResultTotals;
  perCandidate: CandidateResult[];
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

export interface AdminCandidate extends Candidate {
  studentId: number;
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

export interface Student {
  id: number;
  nis: string;
  name: string;
  classId: number | null;
  className: string | null;
  gradeLevel: GradeLevel | null;
  hasVoted: boolean;
  /** Nomor urut bila siswa ini terdaftar sebagai kandidat. */
  candidateNumber: number | null;
  createdAt: string;
}
