import { defineMiddleware } from 'astro:middleware';
import { getActionContext } from 'astro:actions';
import { createSupabaseServerClient } from './lib/supabase/server';
import type { Profile } from './lib/types';

const PUBLIC_PATHS = ['/login', '/wachtwoord-vergeten', '/wachtwoord-resetten'];

export const onRequest = defineMiddleware(async (context, next) => {
  // Acties met accept:'form' worden pas uitgevoerd op het moment dat de
  // pagina zelf Astro.getActionResult() aanroept — voor uitloggen willen we
  // altijd meteen naar /login redirecten, ongeacht welke pagina het formulier
  // toont, dus voeren we die ene actie hier eagerly uit (het officiële
  // patroon voor acties afhandelen in middleware).
  const { action, setActionResult, serializeActionResult } = getActionContext(context);
  if (action?.calledFrom === 'form' && action.name === 'auth.logout') {
    const result = await action.handler();
    setActionResult(action.name, serializeActionResult(result));
    return context.redirect('/login');
  }

  const supabase = createSupabaseServerClient(context.cookies, context.request);
  context.locals.supabase = supabase;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data;
  }

  context.locals.user = user;
  context.locals.profile = profile;

  const pathname = context.url.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith('/api/auth');

  if (!user && !isPublic) {
    return context.redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (user && pathname === '/login') {
    const next = context.url.searchParams.get('next');
    const fallback = profile?.rol === 'admin' ? '/admin/overzicht' : '/mijn-uren';
    return context.redirect(next && next.startsWith('/') ? next : fallback);
  }

  if (pathname.startsWith('/admin') && profile?.rol !== 'admin') {
    return context.redirect('/mijn-uren');
  }

  return next();
});
