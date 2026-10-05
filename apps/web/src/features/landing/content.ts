import { env } from '@/shared/lib/env';

/** The docs are not written yet; until they are, the API's reference is the closest thing. */
export const DOCS_HREF = `${env.NEXT_PUBLIC_API_URL}/docs`;

export const SIGN_IN_HREF = '/login';

export const LANDING = {
  name: 'MCDI',
  headline: 'One identity for every MicroClub project.',
  subtext:
    'Log in with Discord once, sync roles and members, and receive signed data from your project, all through one API.',
  docs: { label: 'Read the docs', href: DOCS_HREF },
  signIn: { label: 'Admin sign in', href: SIGN_IN_HREF },
  screenshot: {
    src: '/landing/admin-panel.webp',
    width: 1960,
    height: 1360,
    alt: 'The MCDI admin panel showing the submissions of a hackathon registration webhook: a table of teams with their track and email.',
  },
  metadata: {
    title: 'MicroClub Discord Interface',
    description:
      'MCDI is the identity platform of MicroClub: one Discord login for every club project, synced roles and members, and signed webhooks.',
  },
} as const;
