import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState
} from '@tanstack/react-table';
import { actions } from 'astro:actions';

export interface AdminEntryRow {
  id: string;
  datum: string;
  jufNaam: string;
  categorieNaam: string;
  aantalUren: number;
  uurloon: number;
  bedrag: number;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      columnHelper.accessor('aantalUren', { header: 'Uren', cell: (info) => info.getValue().toFixed(2) }),
      columnHelper.accessor('uurloon', { header: 'Uurloon', cell: (info) => euro.format(info.getValue()) }),
      columnHelper.accessor('bedrag', { header: 'Bedrag', cell: (info) => euro.format(info.getValue()) }),
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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
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
          onChange={(e) => setJufFilter(e.target.value)}
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
          onChange={(e) => setCategorieFilter(e.target.value)}
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
          onChange={(e) => setStatusFilter(e.target.value)}
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
    </div>
  );
}
