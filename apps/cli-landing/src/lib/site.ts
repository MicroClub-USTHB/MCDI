export const REPO_URL = 'https://github.com/MicroClub-USTHB/m-forge';
export const MCDI_URL = 'https://github.com/MicroClub-USTHB/MCDI';
export const MCOLI_URL = 'https://mcoli-ui.microclub.info';

export const SITE_TITLE = 'm-forge, the MCDI Inbound Webhooks CLI';
export const SITE_DESCRIPTION =
  'Authenticate once against MCDI, then author, validate, create and manage Inbound Webhooks from your terminal.';

// m-forge isn't published to npm: it's built from the repo, and `pnpm link` puts `m-forge` on the PATH.
export const INSTALL_COMMAND =
  'git clone https://github.com/MicroClub-USTHB/m-forge.git\ncd m-forge\npnpm install && pnpm build && pnpm link --global';

// Anchors of the landing page sections, in page order. The header nav and the
// mobile drawer both read from this list so they never drift apart.
export const NAV_LINKS = [
  { href: '#quickstart', label: 'Quickstart' },
  { href: '#features', label: 'Features' },
  { href: '#commands', label: 'Commands' },
] as const;
