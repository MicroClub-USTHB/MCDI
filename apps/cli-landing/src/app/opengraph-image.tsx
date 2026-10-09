import { ImageResponse } from 'next/og';

export const alt = 'm-forge, the MCDI Inbound Webhooks CLI';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// mcoli-ui "primary" theme colors (see globals.css).
const PRIMARY = '#0006b1';
const FOREGROUND = '#000350';
const MUTED = '#54588b';
const BORDER = '#e6e9ff';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#ffffff',
          backgroundImage: `linear-gradient(to right, ${BORDER} 1px, transparent 1px), linear-gradient(to bottom, ${BORDER} 1px, transparent 1px)`,
          backgroundSize: '56px 56px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -260,
            left: 250,
            width: 700,
            height: 520,
            borderRadius: 9999,
            background: 'rgba(0, 6, 177, 0.18)',
            filter: 'blur(120px)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 14,
              background: PRIMARY,
              color: '#ffffff',
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {'>_'}
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: FOREGROUND }}>m-forge</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            <span style={{ color: FOREGROUND }}>Inbound Webhooks,</span>
            <span style={{ color: PRIMARY }}>from your terminal.</span>
          </div>
          <div style={{ fontSize: 28, color: MUTED, maxWidth: 820 }}>
            Log in once, pre-check form schemas offline, and manage MCDI webhooks from the CLI.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            alignSelf: 'flex-start',
            padding: '14px 22px',
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            background: '#ffffff',
            fontSize: 24,
            fontFamily: 'monospace',
          }}
        >
          <span style={{ color: PRIMARY }}>$</span>
          <span style={{ color: FOREGROUND }}>m-forge schema validate form.json</span>
          <span style={{ color: '#16a34a' }}>Schema is valid</span>
        </div>
      </div>
    ),
    size
  );
}
