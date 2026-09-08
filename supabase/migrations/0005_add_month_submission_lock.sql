-- Een juf mag haar uren maar 1x per maand indienen: zodra "Uren indienen"
-- is aangeklikt, wordt de maand vergrendeld (locked_at). Zolang de maand
-- vergrendeld is, kan ze niets meer indienen of nieuwe uren toevoegen voor
-- die maand. De beheerder kan de maand terug openzetten (locked_at op null
-- zetten en de ingediende uren terugzetten naar concept) via admin.reopenMonth.

alter table month_submissions add column locked_at timestamptz;
