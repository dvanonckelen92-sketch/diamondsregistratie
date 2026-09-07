import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState
} from '@tanstack/react-table';
import { actions } from 'astro:actions';
import { formatUren } from '../lib/format';

export interface AdminEntryRow {
  id: string;
  datum: string;
  jufNaam: string;
  categorieNaam: string;
  aantalUren: number;
  // NULL wanneer er nog geen tarief bestaat voor deze juf + categorie.
  uurloon: number | null;
  bedrag: number | null;
  status: 'concept' | 'ingediend' | 'goedgekeurd' | 'betaald';
  opmerking: string | null;
}

const STATUS_LABELS: Record<AdminEntryRow['status'], string> = {
  concept: 'Concept',
  ingediend: 'Ingediend',
  goedgekeurd: 'Goedgekeurd',
  betaald: 'Betaald'
};

const STATUS_STYLES: Record<AdminEntryRow['status'], string> = {
  concept: 'bg-slate-100 text-slate-700',
  ingediend: 'bg-amber-100 text-amber-800',
  goedgekeurd: 'bg-blue-100 text-blue-800',
  betaald: 'bg-green-100 text-green-800'
};

const euro = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' });

const columnHelper = createColumnHelper<AdminEntryRow>();

export default function AdminEntriesTable({ initialRows }: { initialRows: AdminEntryRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([{ id: 'datum', desc: true }]);
  const [jufFilter, setJufFilter] = useState('');
  const [categorieFilter, setCategorieFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  const jufOpties = useMemo(() => [...new Set(rows.map((r) => r.jufNaam))].sort(), [rows]);
  const categorieOpties = useMemo(() => [...new Set(rows.map((r) => r.categorieNaam))].sort(), [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!jufFilter || r.jufNaam === jufFilter) &&
          (!categorieFilter || r.categorieNaam === categorieFilter) &&
          (!statusFilter || r.status === statusFilter)
      ),
    [rows, jufFilter, categorieFilter, statusFilter]
  );

  const totalen = useMemo(() => {
    let uren = 0;
    let bedrag = 0;
    let heeftOntbrekendTarief = false;
    for (const r of filteredRows) {
      uren += r.aantalUren;
      if (r.bedrag === null) heeftOntbrekendTarief = true;
      else bedrag += r.bedrag;
    }
    return { uren, bedrag, heeftOntbrekendTarief };
  }, [filteredRows]);

  // Deze tabel toont bewust altijd de volledige maand, los van de juf/categorie/status-filters
  // hierboven — het dient als vast maandoverzicht per juf, niet als weergave van de huidige filter.
  const totaalPerJuf = useMemo(() => {
    const map = new Map<string, { uren: number; bedrag: number }>();
    for (const r of rows) {
      const huidig = map.get(r.jufNaam) ?? { uren: 0, bedrag: 0 };
      huidig.uren += r.aantalUren;
      huidig.bedrag += r.bedrag ?? 0;
      map.set(r.jufNaam, huidig);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id))}
            onChange={(e) => {
              const next = new Set(selected);
              for (const r of filteredRows) {
                if (e.target.checked) next.add(r.id);
                else next.delete(r.id);
              }
              setSelected(next);
            }}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selected.has(row.original.id)}
            onChange={(e) => {
              const next = new Set(selected);
              if (e.target.checked) next.add(row.original.id);
              else next.delete(row.original.id);
              setSelected(next);
            }}
          />
        )
      }),
      columnHelper.accessor('datum', { header: 'Datum' }),
      columnHelper.accessor('jufNaam', { header: 'Juf' }),
      columnHelper.accessor('categorieNaam', { header: 'Categorie' }),
      columnHelper.accessor('aantalUren', { header: 'Uren', cell: (info) => formatUren(info.getValue()) }),
      columnHelper.accessor('uurloon', {
        header: 'Uurloon',
        cell: (info) => {
          const value = info.getValue();
          return value === null ? <span className="text-amber-600">Geen tarief</span> : euro.format(value);
        }
      }),
      columnHelper.accessor('bedrag', {
        header: 'Bedrag',
        cell: (info) => {
          const value = info.getValue();
          return value === null ? <span className="text-amber-600">Geen tarief</span> : euro.format(value);
        }
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[info.getValue()]}`}>
            {STATUS_LABELS[info.getValue()]}
          </span>
        )
      }),
      columnHelper.accessor('opmerking', { header: 'Opmerking', cell: (info) => info.getValue() ?? '' })
    ],
    [selected, filteredRows]
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  async function runBulkAction(kind: 'approve' | 'paid') {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    const ids = [...selected];
    const result =
      kind === 'approve' ? await actions.admin.approveEntries({ ids }) : await actions.admin.markEntriesPaid({ ids });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const nieuweStatus = kind === 'approve' ? 'goedgekeurd' : 'betaald';
    setRows((prev) => prev.map((r) => (selected.has(r.id) ? { ...r, status: nieuweStatus } : r)));
    setSelected(new Set());
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={jufFilter}
          onChange={(e) => updateFilter(setJufFilter, e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Alle juffen</option>
          {jufOpties.map((naam) => (
            <option key={naam} value={naam}>
              {naam}
            </option>
          ))}
        </select>
        <select
          value={categorieFilter}
          onChange={(e) => updateFilter(setCategorieFilter, e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Alle categorieën</option>
          {categorieOpties.map((naam) => (
            <option key={naam} value={naam}>
              {naam}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => updateFilter(setStatusFilter, e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Alle statussen</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={() => runBulkAction('approve')}
            className="rounded-md border border-brand-gold px-3 py-1.5 text-sm font-medium text-brand-gold-dark enabled:hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            Goedkeuren ({selected.size})
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={() => runBulkAction('paid')}
            className="rounded-md bg-brand-red px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Markeer betaald ({selected.size})
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="cursor-pointer select-none whitespace-nowrap px-3 py-2"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                  Geen registraties gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span>Rijen per pagina</span>
          <select
            value={pagination.pageSize}
            onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span>
            {filteredRows.length === 0
              ? '0 resultaten'
              : `${pagination.pageIndex * pagination.pageSize + 1}–${Math.min(
                  (pagination.pageIndex + 1) * pagination.pageSize,
                  filteredRows.length
                )} van ${filteredRows.length}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-slate-300 px-3 py-1.5 enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Vorige
          </button>
          <span>
            Pagina {table.getPageCount() === 0 ? 0 : pagination.pageIndex + 1} van {table.getPageCount()}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-slate-300 px-3 py-1.5 enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Volgende
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">Totaal uren</div>
          <div className="text-lg font-semibold">{formatUren(totalen.uren)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">Totaal bedrag</div>
          <div className="text-lg font-semibold">{euro.format(totalen.bedrag)}</div>
          {totalen.heeftOntbrekendTarief && (
            <div className="mt-1 text-xs text-amber-600">Exclusief registraties zonder tarief</div>
          )}
        </div>
      </div>

      {totaalPerJuf.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Totaal per juf (volledige maand)</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Juf</th>
                  <th className="px-3 py-2">Uren</th>
                  <th className="px-3 py-2">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {totaalPerJuf.map(([naam, totaal]) => (
                  <tr key={naam} className="border-t border-slate-100">
                    <td className="px-3 py-2">{naam}</td>
                    <td className="px-3 py-2">{formatUren(totaal.uren)}</td>
                    <td className="px-3 py-2">{euro.format(totaal.bedrag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
