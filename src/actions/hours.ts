import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';

function requireUser(context: { locals: App.Locals }) {
  if (!context.locals.user) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Niet ingelogd.' });
  }
  return context.locals.user;
}

export const hours = {
  create: defineAction({
    accept: 'form',
    input: z.object({
      datum: z.string(),
      categoryId: z.string().uuid(),
      aantalUren: z.coerce.number().positive(),
      opmerking: z.string().optional()
    }),
    handler: async ({ datum, categoryId, aantalUren, opmerking }, context) => {
      const user = requireUser(context);
      const { error } = await context.locals.supabase.from('hour_entries').insert({
        profile_id: user.id,
        category_id: categoryId,
        datum,
        aantal_uren: aantalUren,
        opmerking: opmerking || null
      });
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  update: defineAction({
    accept: 'form',
    input: z.object({
      id: z.string().uuid(),
      datum: z.string(),
      categoryId: z.string().uuid(),
      aantalUren: z.coerce.number().positive(),
      opmerking: z.string().optional()
    }),
    handler: async ({ id, datum, categoryId, aantalUren, opmerking }, context) => {
      requireUser(context);
      const { error } = await context.locals.supabase
        .from('hour_entries')
        .update({
          category_id: categoryId,
          datum,
          aantal_uren: aantalUren,
          opmerking: opmerking || null
        })
        .eq('id', id);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  delete: defineAction({
    accept: 'form',
    input: z.object({ id: z.string().uuid() }),
    handler: async ({ id }, context) => {
      requireUser(context);
      const { error } = await context.locals.supabase.from('hour_entries').delete().eq('id', id);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  }),

  submitMonth: defineAction({
    accept: 'form',
    input: z.object({ maand: z.string().regex(/^\d{4}-\d{2}$/) }),
    handler: async ({ maand }, context) => {
      const user = requireUser(context);
      const start = `${maand}-01`;
      const [jaar, m] = maand.split('-').map(Number);
      const eind = new Date(Date.UTC(jaar, m, 1)).toISOString().slice(0, 10);

      const { error } = await context.locals.supabase
        .from('hour_entries')
        .update({ status: 'ingediend' })
        .eq('profile_id', user.id)
        .eq('status', 'concept')
        .gte('datum', start)
        .lt('datum', eind);
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });
      return { success: true };
    }
  })
};
