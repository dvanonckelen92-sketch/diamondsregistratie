import type { HourEntryStatus } from './types';

export function formatEuro(bedrag: number): string {
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(bedrag);
}

export function formatDatum(datum: string): string {
  return new Intl.DateTimeFormat('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(datum + 'T00:00:00')
  );
}

export const STATUS_LABELS: Record<HourEntryStatus, string> = {
  concept: 'Concept',
  ingediend: 'Ingediend',
  goedgekeurd: 'Goedgekeurd',
  betaald: 'Betaald'
};

export const STATUS_STYLES: Record<HourEntryStatus, string> = {
  concept: 'bg-slate-100 text-slate-700',
  ingediend: 'bg-amber-100 text-amber-800',
  goedgekeurd: 'bg-blue-100 text-blue-800',
  betaald: 'bg-green-100 text-green-800'
};

export function huidigeMaand(): string {
  return new Date().toISOString().slice(0, 7);
}

export function maandBereik(maand: string): { start: string; eind: string } {
  const [jaar, m] = maand.split('-').map(Number);
  const start = `${maand}-01`;
  const eind = new Date(Date.UTC(jaar, m, 1)).toISOString().slice(0, 10);
  return { start, eind };
}
