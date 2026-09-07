import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';

function requireUser(context: { locals: App.Locals }) {
  if (!context.locals.user) {
    throw new ActionError({ code: 'UNAUTHORIZED', message: 'Niet ingelogd.' });
  }
  return context.locals.user;
}

const urenKwartierInput = {
  uren: z.coerce.number().int().min(0),
  minuten: z.coerce.number().int().refine((v) => [0, 15, 30, 45].includes(v), {
    message: 'Minuten moet 0, 15, 30 of 45 zijn.'
  })
};

function naarDecimaalUren(uren: number, minuten: number): number {
  const totaal = uren + minuten / 60;
  if (totaal <= 0) {
    throw new ActionError({ code: 'BAD_REQUEST', message: 'Vul een aantal uren in groter dan 0.' });
  }
  return totaal;
}

export const hours = {
  create: defineAction({
    accept: 'form',
    input: z.object({
      datum: z.string(),
      categoryId: z.string().uuid(),
      ...urenKwartierInput,
      opmerking: z.string().optional()
    }),
    handler: async ({ datum, categoryId, uren, minuten, opmerking }, context) => {
      const user = requireUser(context);
      const { error } = await context.locals.supabase.from('hour_entries').insert({
        profile_id: user.id,
        category_id: categoryId,
        datum,
        aantal_uren: naarDecimaalUren(uren, minuten),
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
      ...urenKwartierInput,
      opmerking: z.string().optional()
    }),
    handler: async ({ id, datum, categoryId, uren, minuten, opmerking }, context) => {
      requireUser(context);
      const { error } = await context.locals.supabase
        .from('hour_entries')
        .update({
          category_id: categoryId,
          datum,
          aantal_uren: naarDecimaalUren(uren, minuten),
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
    input: z.object({
      maand: z.string().regex(/^\d{4}-\d{2}$/),
      opmerking: z.string().optional()
    }),
    handler: async ({ maand, opmerking }, context) => {
      const user = requireUser(context);
      const start = `${maand}-01`;
      const [jaar, m] = maand.split('-').map(Number);
      const eind = new Date(Date.UTC(jaar, m, 1)).toISOString().slice(0, 10);

      const { data: bijgewerkt, error } = await context.locals.supabase
        .from('hour_entries')
        .update({ status: 'ingediend' })
        .eq('profile_id', user.id)
        .eq('status', 'concept')
        .gte('datum', start)
        .lt('datum', eind)
        .select('id');
      if (error) throw new ActionError({ code: 'BAD_REQUEST', message: error.message });

      // Enkel bij een effectieve indiening mag de opmerking (opnieuw) worden vastgelegd —
      // anders zou iemand de opmerking van een reeds ingediende maand alsnog kunnen
      // wijzigen door de actie manueel opnieuw aan te roepen nadat de knop al disabled is.
      if (bijgewerkt.length === 0) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Er zijn geen openstaande uren om in te dienen.' });
      }

      const { error: opmerkingError } = await context.locals.supabase
        .from('month_submissions')
        .upsert(
          { profile_id: user.id, maand, opmerking: opmerking || null },
          { onConflict: 'profile_id,maand' }
        );
      if (opmerkingError) throw new ActionError({ code: 'BAD_REQUEST', message: opmerkingError.message });

      return { success: true };
    }
  })
};
