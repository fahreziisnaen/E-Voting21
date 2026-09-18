import { CircleCheck } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { cn } from '../../lib/cn';
import { canVoteIn, VOTER_SCOPE_LABEL } from '../../lib/voting';
import type { Category, Role } from '../../types';

/** Kategori terpilih disimpan di URL (?kategori=ID) agar bisa dibagikan & bertahan saat pindah halaman. */
export function useSelectedCategory(categories: Category[] | undefined) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = Number(searchParams.get('kategori'));
  const selected = categories?.find((c) => c.id === requested) ?? categories?.[0];

  function select(categoryId: number) {
    setSearchParams(
      (params) => {
        params.set('kategori', String(categoryId));
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  return [selected, select] as const;
}

interface CategoryTabsProps {
  categories: Category[];
  selectedId: number | undefined;
  onSelect: (categoryId: number) => void;
  /** Peran pemilih yang sedang masuk (null untuk tamu). */
  role: Role | null;
  votedCategoryIds: Set<number>;
  tone?: 'light' | 'navy';
}

export function CategoryTabs({ categories, selectedId, onSelect, role, votedCategoryIds, tone = 'light' }: CategoryTabsProps) {
  if (categories.length < 2) return null;
  return (
    <div role="group" aria-label="Pilih kategori" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {categories.map((category) => {
        const active = category.id === selectedId;
        const voted = votedCategoryIds.has(category.id);
        const restricted = category.voterScope !== 'all';
        const notEligible = role !== null && !canVoteIn(role, category.voterScope);
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(category.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors',
              tone === 'navy'
                ? active
                  ? 'border-gold bg-gold text-ink'
                  : 'border-white/30 text-white hover:border-white/60'
                : active
                  ? 'border-navy bg-navy text-white'
                  : 'border-line-strong bg-white text-ink hover:border-ink-subtle',
            )}
          >
            {voted && <CircleCheck aria-hidden className={cn('size-4', active && tone === 'light' ? 'text-success-line' : 'text-success')} />}
            {category.name}
            {voted && <span className="sr-only"> (sudah memilih)</span>}
            {restricted && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-[0.04em] uppercase',
                  active ? 'bg-white/20' : tone === 'navy' ? 'bg-white/10' : 'bg-line-soft text-ink-muted',
                  notEligible && 'line-through',
                )}
              >
                {VOTER_SCOPE_LABEL[category.voterScope]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
