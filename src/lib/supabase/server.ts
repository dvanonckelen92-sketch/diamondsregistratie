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
        getAll() {
          const header = request.headers.get('cookie') ?? '';
          return header.split(';').flatMap((pair) => {
            const [name, ...rest] = pair.trim().split('=');
            if (!name) return [];
            return [{ name, value: decodeURIComponent(rest.join('=')) }];
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
