import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AgapAI — Emergency Response Command Center',
    short_name: 'AgapAI',
    description:
      'AI-powered emergency reporting and dispatch. Works offline — reports queue locally and send when signal returns.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    background_color: '#0A0A0D',
    theme_color: '#0A0A0D',
    lang: 'en',
    dir: 'ltr',
    orientation: 'any',
    categories: ['health', 'medical', 'safety', 'utilities'],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dispatcher Command Center',
        short_name: 'Dispatch',
        description: 'Live incident queue and map for dispatchers.',
        url: '/dispatcher',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Responder Assignments',
        short_name: 'Respond',
        description: 'Assigned incidents for field responders.',
        url: '/responder',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
