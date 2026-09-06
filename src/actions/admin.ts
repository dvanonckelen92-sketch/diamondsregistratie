import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { createSupabaseAdminClient } from '../lib/supabase/admin';

function requireAdmin(context: { locals: App.Locals }) {
  if (context.locals.profile?.rol !== 'admin') {
    throw new ActionError({ code: 'FORBIDDEN', message: 'Enkel beheerders mogen dit.' });
  }
}

export const admin = {
  approveEntries: defineAction({
    input: z.object({ ids: z.array(z.string().uuid()).min(1) }),
    handler: async ({ ids }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase
        .from('hour_entries')
        .update({ status: 'goedgekeurd' })
        .in('id', ids);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  markEntriesPaid: defineAction({
    input: z.object({ ids: z.array(z.string().uuid()).min(1) }),
    handler: async ({ ids }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase
        .from('hour_entries')
        .update({ status: 'betaald' })
        .in('id', ids);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  setEntryStatus: defineAction({
    accept: 'form',
    input: z.object({
      id: z.string().uuid(),
      status: z.enum(['concept', 'ingediend', 'goedgekeurd', 'betaald'])
    }),
    handler: async ({ id, status }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase.from('hour_entries').update({ status }).eq('id', id);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  createCategory: defineAction({
    accept: 'form',
    input: z.object({ naam: z.string().min(1) }),
    handler: async ({ naam }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase.from('categories').insert({ naam });
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  renameCategory: defineAction({
    accept: 'form',
    input: z.object({ id: z.string().uuid(), naam: z.string().min(1) }),
    handler: async ({ id, naam }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase.from('categories').update({ naam }).eq('id', id);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  deleteCategory: defineAction({
    accept: 'form',
    input: z.object({ id: z.string().uuid() }),
    handler: async ({ id }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase.from('categories').delete().eq('id', id);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  createJuf: defineAction({
    accept: 'form',
    input: z.object({ naam: z.string().min(1), email: z.string().email() }),
    handler: async ({ naam, email }, context) => {
      requireAdmin(context);
      const adminClient = createSupabaseAdminClient();
      const redirectTo = new URL('/wachtwoord-resetten', context.url.origin).toString();
      const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { naam, rol: 'juf' },
        redirectTo
      });
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  createRate: defineAction({
    accept: 'form',
    input: z.object({
      profileId: z.string().uuid(),
      categoryId: z.string().uuid(),
      uurloon: z.coerce.number().nonnegative(),
      geldigVanaf: z.string()
    }),
    handler: async ({ profileId, categoryId, uurloon, geldigVanaf }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase.from('rates').insert({
        profile_id: profileId,
        category_id: categoryId,
        uurloon,
        geldig_vanaf: geldigVanaf
      });
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  updateRate: defineAction({
    accept: 'form',
    input: z.object({
      id: z.string().uuid(),
      uurloon: z.coerce.number().nonnegative(),
      geldigVanaf: z.string()
    }),
    handler: async ({ id, uurloon, geldigVanaf }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase
        .from('rates')
        .update({ uurloon, geldig_vanaf: geldigVanaf })
        .eq('id', id);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  deleteRate: defineAction({
    accept: 'form',
    input: z.object({ id: z.string().uuid() }),
    handler: async ({ id }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase.from('rates').delete().eq('id', id);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  createExtraPayment: defineAction({
    accept: 'form',
    input: z.object({
      profileId: z.string().uuid(),
      bedrag: z.coerce.number(),
      omschrijving: z.string().min(1),
      datum: z.string()
    }),
    handler: async ({ profileId, bedrag, omschrijving, datum }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase.from('extra_payments').insert({
        profile_id: profileId,
        bedrag,
        omschrijving,
        datum
      });
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  markExtraPaid: defineAction({
    accept: 'form',
    input: z.object({ ids: z.array(z.string().uuid()).min(1) }),
    handler: async ({ ids }, context) => {
      requireAdmin(context);
      const { error } = await context.locals.supabase
        .from('extra_payments')
        .update({ status: 'betaald' })
        .in('id', ids);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  })
};
