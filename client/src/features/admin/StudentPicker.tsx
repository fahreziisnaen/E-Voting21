import { ChevronLeft, ChevronRight, Search, SearchX, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useClasses, useDebouncedValue, useStudents } from '../../hooks/admin';
import { errorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { formatNumber, initials } from '../../lib/format';
import { ClassSelect, GRADE_FILTER_OPTIONS, type GradeFilter } from './ClassSelect';
import { ErrorNotice, selectClass } from './AdminUi';

export interface PickedStudent {
  id: number;
  nis: string;
  name: string;
  className: string | null;
}

interface StudentPickerProps {
  value: PickedStudent | null;
  onChange: (student: PickedStudent | null) => void;
  /** Siswa milik kandidat yang sedang diedit tetap bisa dipilih ulang. */
  currentStudentId?: number;
  error?: string;
  disabled?: boolean;
}

const PAGE_SIZE = 8;

/** Pemilih siswa untuk kandidat: pencarian NIS/nama + filter tingkat & kelas. */
export function StudentPicker({ value, onChange, currentStudentId, error, disabled }: StudentPickerProps) {
  const classes = useClasses();
  const [search, setSearch] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeFilter>('');
  const [classId, setClassId] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());
  const students = useStudents({ page, pageSize: PAGE_SIZE, q, gradeLevel, classId });

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
            NIS {value.nis}
            {value.className ? ` · ${value.className}` : ''}
          </p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} className="btn btn-outline h-9 shrink-0 px-3 text-[13px]">
            Ganti siswa
          </button>
        )}
      </div>
    );
  }

  const data = students.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className={cn('rounded-card border p-3', error ? 'border-danger' : 'border-line')}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_150px]">
        <div className="relative">
          <label htmlFor="pilih-siswa-cari" className="sr-only">
            Cari siswa berdasarkan NIS atau nama
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            id="pilih-siswa-cari"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari NIS atau nama siswa"
            autoComplete="off"
            className="field-input h-10 pl-9 text-sm"
          />
        </div>
        <div>
          <label htmlFor="pilih-siswa-tingkat" className="sr-only">
            Tingkat
          </label>
          <select
            id="pilih-siswa-tingkat"
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
          <label htmlFor="pilih-siswa-kelas" className="sr-only">
            Kelas
          </label>
          <ClassSelect
            id="pilih-siswa-kelas"
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
      </div>

      <div className={cn('mt-3 transition-opacity', students.isPlaceholderData && 'opacity-60')} aria-live="polite" aria-busy={students.isFetching}>
        {students.isError ? (
          <ErrorNotice message={errorMessage(students.error)} onRetry={() => void students.refetch()} />
        ) : !data ? (
          <div aria-hidden className="grid gap-1.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-control bg-line-soft" />
            ))}
          </div>
        ) : data.students.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center text-sm text-ink-muted">
            <SearchX aria-hidden className="size-6" />
            {data.total === 0 && !q && !gradeLevel && !classId ? (
              <p>
                Belum ada data siswa.{' '}
                <Link to="/admin/siswa" className="font-bold text-royal">
                  Impor siswa
                </Link>{' '}
                terlebih dahulu.
              </p>
            ) : (
              <p>Tidak ada siswa yang cocok.</p>
            )}
          </div>
        ) : (
          <ul className="grid gap-1.5">
            {data.students.map((student) => {
              const takenBy = student.candidateNumber !== null && student.id !== currentStudentId ? student.candidateNumber : null;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    disabled={takenBy !== null}
                    onClick={() => onChange({ id: student.id, nis: student.nis, name: student.name, className: student.className })}
                    className="flex w-full items-center gap-3 rounded-control border border-transparent px-2.5 py-2 text-left transition-colors hover:border-royal hover:bg-royal-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-transparent disabled:hover:bg-transparent"
                  >
                    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-line-soft text-[11px] font-extrabold text-navy">
                      {initials(student.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{student.name}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        NIS {student.nis} · {student.className ?? 'Tanpa kelas'}
                      </span>
                    </span>
                    {takenBy !== null ? (
                      <span className="shrink-0 rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-bold text-ink-body">
                        Kandidat No. {takenBy}
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
          <span>{formatNumber(data.total)} siswa</span>
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
