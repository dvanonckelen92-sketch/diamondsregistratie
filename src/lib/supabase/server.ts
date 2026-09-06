import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const cookieOptions: CookieOptionsWithName = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: import.meta.env.PROD
};

export function createSupabaseServerClient(cookies: AstroCookies, request: Request) {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions,
      cookies: {
        // Ga via cookies.get() (niet de ruwe request-header) zodat we ook
        // cookie-mutaties zien die eerder in dit verzoek al gebeurd zijn
        // (bv. auth.signOut() in een Action, die vóór onze middleware draait
        // maar op dezelfde AstroCookies-instantie).
        getAll() {
          const header = request.headers.get('cookie') ?? '';
          const names = new Set(
            header
              .split(';')
              .map((pair) => pair.trim().split('=')[0])
              .filter(Boolean)
          );
          return [...names].flatMap((name) => {
            const cookie = cookies.get(name);
            if (cookie === undefined) return [];
            return [{ name, value: cookie.value }];
          });
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookies.set(name, value, { ...cookieOptions, ...options });
          }
        }
      }
    }
  );
}
