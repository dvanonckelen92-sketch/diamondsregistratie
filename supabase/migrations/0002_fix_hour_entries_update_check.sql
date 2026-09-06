-- Fix: de update-policy op hour_entries had geen expliciete WITH CHECK,
-- waardoor Postgres terugvalt op dezelfde expressie als USING. Dat blokkeerde
-- de eigen concept -> ingediend overgang bij "Uren indienen", omdat de
-- NIEUWE rij na de update geen status 'concept' meer heeft.

drop policy "juf bewerkt eigen concept-uren" on hour_entries;

create policy "juf bewerkt eigen concept-uren" on hour_entries
  for update using (
    (profile_id = auth.uid() and status = 'concept') or is_admin()
  )
  with check (
    (profile_id = auth.uid() and status in ('concept', 'ingediend')) or is_admin()
  );
