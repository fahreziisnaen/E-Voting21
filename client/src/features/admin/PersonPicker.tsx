import { ChevronLeft, ChevronRight, Search, SearchX, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useClasses, useDebouncedValue, useVoters } from '../../hooks/admin';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatNumber, initials } from '../../lib/format';
import { ROLE_LABEL } from '../../lib/voting';
import type { VoterRole } from '../../types';
import { ErrorNotice, selectClass } from './AdminUi';
import { ClassSelect, GRADE_FILTER_OPTIONS, type GradeFilter } from './ClassSelect';

export interface PickedPerson {
  id: number;
  nis: string;
  name: string;
  role: VoterRole;
  className: string | null;
}

interface PersonPickerProps {
  value: PickedPerson | null;
  onChange: (person: PickedPerson | null) => void;
  /** Kandidat yang sedang diedit tetap bisa dipilih ulang. */
  currentUserId?: number;
  /** Orang yang sudah menjadi kandidat di kategori ini tidak dapat dipilih lagi. */
  categoryId?: number;
  error?: string;
  disabled?: boolean;
}

const PAGE_SIZE = 8;
const ROLE_TABS: VoterRole[] = ['student', 'teacher'];

/** Pemilih orang untuk kandidat: siswa atau guru, dengan pencarian dan filter kelas. */
export function PersonPicker({ value, onChange, currentUserId, categoryId, error, disabled }: PersonPickerProps) {
  const classes = useClasses();
  const [role, setRole] = useState<VoterRole>('student');
  const [search, setSearch] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeFilter>('');
  const [classId, setClassId] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const isStudent = role === 'student';
  const voters = useVoters(role, {
    page,
    pageSize: PAGE_SIZE,
    q,
    gradeLevel: isStudent ? gradeLevel : '',
    classId: isStudent ? classId : '',
  });
  const idLabel = isStudent ? 'NIS' : 'Username';

  if (value) {
    return (
      <div className={cn('flex items-center gap-3 rounded-card border bg-canvas p-3', error ? 'border-danger' : 'border-line')}>
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-extrabold text-white">
          {initials(value.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-bold">
            <UserCheck aria-hidden className="size-4 shrink-0 text-success-ink" />
            {value.name}
          </p>
          <p className="truncate text-[13px] text-ink-muted">
            {ROLE_LABEL[value.role]} · {value.role === 'teacher' ? 'Username' : 'NIS'} {value.nis}
            {value.className ? ` · ${value.className}` : ''}
          </p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} className="btn btn-outline h-9 shrink-0 px-3 text-[13px]">
            Ganti orang
          </button>
        )}
      </div>
    );
  }

  const data = voters.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className={cn('rounded-card border p-3', error ? 'border-danger' : 'border-line')}>
      <div role="group" aria-label="Jenis kandidat" className="mb-2.5 flex gap-1.5">
        {ROLE_TABS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={role === option}
            onClick={() => {
              setRole(option);
              setPage(1);
              setClassId('');
              setGradeLevel('');
            }}
            className={cn(
              'h-9 rounded-full border px-4 text-[13px] font-bold transition-colors',
              role === option ? 'border-royal bg-royal-soft text-royal' : 'border-line text-ink-muted hover:border-royal hover:text-royal',
            )}
          >
            {ROLE_LABEL[option]}
          </button>
        ))}
      </div>

      <div className={cn('grid gap-2', isStudent ? 'sm:grid-cols-[minmax(0,1fr)_130px_150px]' : '')}>
        <div className="relative">
          <label htmlFor="pilih-orang-cari" className="sr-only">
            Cari {ROLE_LABEL[role].toLowerCase()} berdasarkan {idLabel} atau nama
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="pilih-orang-cari"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={`Cari ${idLabel} atau nama ${ROLE_LABEL[role].toLowerCase()}`}
            autoComplete="off"
            className="field-input h-10 pl-9 text-sm"
          />
        </div>
        {isStudent && (
          <>
            <div>
              <label htmlFor="pilih-orang-tingkat" className="sr-only">
                Tingkat
              </label>
              <select
                id="pilih-orang-tingkat"
                value={gradeLevel}
                onChange={(e) => {
                  setGradeLevel(e.target.value as GradeFilter);
                  setClassId('');
                  setPage(1);
                }}
                className={cn(selectClass, 'w-full')}
              >
                {GRADE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pilih-orang-kelas" className="sr-only">
                Kelas
              </label>
              <ClassSelect
                id="pilih-orang-kelas"
                classes={classes.data}
                value={classId}
                onChange={(next) => {
                  setClassId(next);
                  setPage(1);
                }}
                placeholder="Semua kelas"
                gradeFilter={gradeLevel}
                className={cn(selectClass, 'w-full')}
              />
            </div>
          </>
        )}
      </div>

      <div className={cn('mt-3 transition-opacity', voters.isPlaceholderData && 'opacity-60')} aria-live="polite" aria-busy={voters.isFetching}>
        {voters.isError ? (
          <ErrorNotice message={errorMessage(voters.error)} onRetry={() => void voters.refetch()} />
        ) : !data ? (
          <div aria-hidden className="grid gap-1.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-control bg-line-soft" />
            ))}
          </div>
        ) : data.voters.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center text-sm text-ink-muted">
            <SearchX aria-hidden className="size-6" />
            {data.total === 0 && !q && !gradeLevel && !classId ? (
              <p>
                Belum ada data {ROLE_LABEL[role].toLowerCase()}.{' '}
                <Link to={isStudent ? '/admin/siswa' : '/admin/guru'} className="font-bold text-royal">
                  Impor data
                </Link>{' '}
                terlebih dahulu.
              </p>
            ) : (
              <p>Tidak ada {ROLE_LABEL[role].toLowerCase()} yang cocok.</p>
            )}
          </div>
        ) : (
          <ul className="grid gap-1.5">
            {data.voters.map((person) => {
              const taken = person.id === currentUserId ? undefined : person.candidacies.find((c) => c.categoryId === categoryId);
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    disabled={Boolean(taken)}
                    onClick={() => onChange({ id: person.id, nis: person.nis, name: person.name, role, className: person.className })}
                    className="flex w-full items-center gap-3 rounded-control border border-transparent px-2.5 py-2 text-left transition-colors hover:border-royal hover:bg-royal-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-transparent disabled:hover:bg-transparent"
                  >
                    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-line-soft text-[11px] font-extrabold text-navy">
                      {initials(person.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{person.name}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        {idLabel} {person.nis}
                        {isStudent ? ` · ${person.className ?? 'Tanpa kelas'}` : ''}
                      </span>
                    </span>
                    {taken ? (
                      <span className="shrink-0 rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-bold text-ink-body">
                        Kandidat No. {taken.candidateNumber}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-bold text-royal">Pilih</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="mt-2 flex items-center gap-2 border-t border-line-soft pt-2 text-xs text-ink-muted">
          <span>
            {formatNumber(data.total)} {ROLE_LABEL[role].toLowerCase()}
          </span>
          <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="btn btn-outline ml-auto h-8 px-2" aria-label="Halaman sebelumnya">
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <span className="font-semibold text-ink">
            {page} / {pages}
          </span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages} className="btn btn-outline h-8 px-2" aria-label="Halaman berikutnya">
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
