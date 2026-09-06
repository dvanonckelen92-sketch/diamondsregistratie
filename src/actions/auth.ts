import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { createSupabaseServerClient } from '../lib/supabase/server';

export const auth = {
  login: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string().email(),
      wachtwoord: z.string().min(1),
      next: z.string().optional()
    }),
    handler: async ({ email, wachtwoord }, context) => {
      const supabase = createSupabaseServerClient(context.cookies, context.request);
      const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
      if (error) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'E-mail of wachtwoord is onjuist.' });
      }
      return { success: true };
    }
  }),

  logout: defineAction({
    accept: 'form',
    handler: async (_input, context) => {
      const supabase = createSupabaseServerClient(context.cookies, context.request);
      await supabase.auth.signOut();
      return { success: true };
    }
  }),

  requestPasswordReset: defineAction({
    accept: 'form',
    input: z.object({ email: z.string().email() }),
    handler: async ({ email }, context) => {
      const supabase = createSupabaseServerClient(context.cookies, context.request);
      const redirectTo = new URL('/wachtwoord-resetten', context.url.origin).toString();
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      // Altijd success teruggeven, ongeacht of het e-mailadres bestaat,
      // zodat we niet lekken welke e-mailadressen een account hebben.
      return { success: true };
    }
  }),

  updatePassword: defineAction({
    accept: 'form',
    input: z.object({ wachtwoord: z.string().min(8, 'Wachtwoord moet minstens 8 tekens bevatten.') }),
    handler: async ({ wachtwoord }, context) => {
      const supabase = createSupabaseServerClient(context.cookies, context.request);
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Resetlink is verlopen. Vraag een nieuwe aan.' });
      }
      const { error } = await supabase.auth.updateUser({ password: wachtwoord });
      if (error) {
        throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      }
      return { success: true };
    }
  })
};
