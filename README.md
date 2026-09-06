# Uurregistratie-platform Dansschool

Webapp waarmee juffen hun gewerkte uren registreren, en waarmee beheerders (Trees & Fien)
tarieven, goedkeuring, uitbetaling en Excel-export beheren.

Astro (SSR) + React-islands (TanStack Table) + Supabase (Postgres, Auth, RLS) + Tailwind CSS,
gehost op Netlify.

## Supabase opzetten

1. Maak een nieuw project aan op [supabase.com](https://supabase.com).
2. Voer de migratie uit: plak de inhoud van
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in de
   Supabase SQL Editor en run ze (of gebruik de Supabase CLI: `supabase db push`).
3. Zet in **Authentication → Emails** de "Invite user" en "Reset password"
   templates naar wens (optioneel).
4. Maak de eerste beheerder aan:
   - Nodig jezelf uit via **Authentication → Users → Invite user**, of registreer via de
     resetlink-flow.
   - Zet nadien in de SQL editor `update profiles set rol = 'admin' where email = '...';`
     voor het eerste beheerdersaccount (nieuwe accounts krijgen standaard de rol `juf`).

## Lokale ontwikkeling

1. Kopieer `.env.example` naar `.env` en vul in:
   - `PUBLIC_SUPABASE_URL` en `PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — zelfde pagina, **service_role** key. Nooit publiek
     maken; enkel gebruikt in server-side admin-acties (juf-accounts uitnodigen).
2. Installeer dependencies en start de dev-server:

```sh
npm install
npm run dev
```

## Commands

| Command           | Actie                                                |
| :----------------- | :---------------------------------------------------- |
| `npm run dev`      | Start lokale dev-server op `localhost:4321`            |
| `npm run build`    | Bouwt de productie-build naar `./dist/`                |
| `npm run preview`  | Preview van de build lokaal, vóór deployment            |
| `npm run astro check` | Type-check het hele project                         |

## Deployment (Netlify)

Verbind de repository met Netlify (build command `npm run build`, publish directory
`dist`, de `@astrojs/netlify`-adapter regelt de rest). Zet dezelfde drie
omgevingsvariabelen als hierboven in de Netlify site-settings.

## Structuur

- `supabase/migrations/0001_init.sql` — schema, `hour_entries_with_amount`-view en RLS-policies.
- `src/middleware.ts` — sessie ophalen, routebeveiliging (`/admin/*` enkel voor rol `admin`).
- `src/actions/` — alle server-side mutaties (Astro Actions): `auth`, `hours`, `admin`.
- `src/pages/mijn-uren/`, `src/pages/mijn-overzicht/` — juf-flow (mobile-first).
- `src/pages/admin/` — beheerder-flow (overzichtstabel, juffen, tarieven, categorieën, export).
- `src/pages/api/export.ts` — genereert de Excel-export (`exceljs`).

## Rollen

Rollen zitten in `profiles.rol` (`juf` / `admin`), niet hardcoded in de code — een derde rol kan
later toegevoegd worden zonder codewijziging aan het datamodel (wel aan routebeveiliging/UI waar
relevant).
