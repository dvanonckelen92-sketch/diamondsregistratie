import type { APIRoute } from 'astro';
import ExcelJS from 'exceljs';
import type { Category, ExtraPayment, HourEntryWithAmount, Profile } from '../../lib/types';
import { maandBereik } from '../../lib/format';

export const GET: APIRoute = async ({ locals, url }) => {
  if (locals.profile?.rol !== 'admin') {
    return new Response('Niet toegelaten', { status: 403 });
  }

  const supabase = locals.supabase;
  const maand = url.searchParams.get('maand') || '';
  const jufId = url.searchParams.get('jufId') || '';
  const status = url.searchParams.get('status') || '';

  let entriesQuery = supabase.from('hour_entries_with_amount').select('*');
  let extrasQuery = supabase.from('extra_payments').select('*');

  if (maand) {
    const { start, eind } = maandBereik(maand);
    entriesQuery = entriesQuery.gte('datum', start).lt('datum', eind);
    extrasQuery = extrasQuery.gte('datum', start).lt('datum', eind);
  }
  if (jufId) {
    entriesQuery = entriesQuery.eq('profile_id', jufId);
    extrasQuery = extrasQuery.eq('profile_id', jufId);
  }
  if (status) {
    entriesQuery = entriesQuery.eq('status', status);
    if (status === 'betaald' || status === 'goedgekeurd') {
      extrasQuery = extrasQuery.eq('status', status);
    }
  }

  const [{ data: entries }, { data: extras }, { data: profiles }, { data: categories }] = await Promise.all([
    entriesQuery,
    extrasQuery,
    supabase.from('profiles').select('*'),
    supabase.from('categories').select('*')
  ]);

  const profileMap = new Map((profiles as Profile[] | null ?? []).map((p) => [p.id, p.naam]));
  const categoryMap = new Map((categories as Category[] | null ?? []).map((c) => [c.id, c.naam]));

  const workbook = new ExcelJS.Workbook();

  const urenSheet = workbook.addWorksheet('Uren');
  urenSheet.columns = [
    { header: 'Juf', key: 'juf', width: 20 },
    { header: 'Datum', key: 'datum', width: 12 },
    { header: 'Categorie', key: 'categorie', width: 18 },
    { header: 'Aantal uren', key: 'uren', width: 12 },
    { header: 'Uurloon', key: 'uurloon', width: 12 },
    { header: 'Bedrag', key: 'bedrag', width: 12 },
    { header: 'Status', key: 'status', width: 14 }
  ];
  for (const e of (entries as HourEntryWithAmount[] | null) ?? []) {
    urenSheet.addRow({
      juf: profileMap.get(e.profile_id) ?? 'Onbekend',
      datum: e.datum,
      categorie: categoryMap.get(e.category_id) ?? 'Onbekend',
      uren: Number(e.aantal_uren),
      uurloon: e.uurloon === null ? 'Geen tarief' : Number(e.uurloon),
      bedrag: e.bedrag === null ? 'Geen tarief' : Number(e.bedrag),
      status: e.status
    });
  }
  urenSheet.getRow(1).font = { bold: true };

  const extraSheet = workbook.addWorksheet('Extra vergoedingen');
  extraSheet.columns = [
    { header: 'Juf', key: 'juf', width: 20 },
    { header: 'Datum', key: 'datum', width: 12 },
    { header: 'Omschrijving', key: 'omschrijving', width: 30 },
    { header: 'Bedrag', key: 'bedrag', width: 12 },
    { header: 'Status', key: 'status', width: 14 }
  ];
  for (const e of (extras as ExtraPayment[] | null) ?? []) {
    extraSheet.addRow({
      juf: profileMap.get(e.profile_id) ?? 'Onbekend',
      datum: e.datum,
      omschrijving: e.omschrijving,
      bedrag: Number(e.bedrag),
      status: e.status
    });
  }
  extraSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const bestandsnaam = `uurregistratie${maand ? `-${maand}` : ''}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${bestandsnaam}"`
    }
  });
};
