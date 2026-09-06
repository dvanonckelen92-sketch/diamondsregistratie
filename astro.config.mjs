// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'server',

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // Zonder dit wordt @tanstack/react-table pas ontdekt zodra de browser de
    // AdminEntriesTable-island opvraagt, wat een on-demand re-optimize
    // triggert. Op Windows loopt die soms vast op een EPERM tijdens de
    // atomic rename van node_modules/.vite/deps, met een kapotte hydration
    // (404/504 op de dynamic import) tot gevolg. Vooraf opnemen zorgt dat
    // het al gebundeld is bij de initiële cold-start scan.
    optimizeDeps: {
      include: ['@tanstack/react-table']
    }
  },

  adapter: netlify({
    // We gebruiken geen Netlify Edge Functions. De lokale emulatie ervoor
    // (astro dev) downloadt en spawnt een Deno-binary die op dit systeem
    // "--allow-scripts" niet accepteert en crasht (Deno-versie-mismatch in
    // @netlify/edge-bundler) — dat had niets met onze app te maken, maar
    // liet de hele dev-server crashen. Uitschakelen is veilig: de app draait
    // volledig als een Netlify Function/SSR, niet als edge middleware.
    devFeatures: {
      edgeFunctions: false,
      images: true,
      environmentVariables: false
    }
  })
});