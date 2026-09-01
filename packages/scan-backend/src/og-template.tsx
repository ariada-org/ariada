/**
 * @patentBinding('K','IC4')  - severity-coded overlay (Dracula brand)
 * @patentBinding('D','IC1')  - scoring presentation
 *
 * Renders an OG image as JSX-shaped object literal. Apps' /api/og/[slug] route
 * uses Satori-based renderers (e.g. @vercel/og or satori-html + resvg-js) to
 * convert this to a PNG. Brand-themed via props; no per-brand hardcodes.
 *
 * Pure function — runtime-agnostic.
 */
export interface OgProps {
  brand: 'ariada' | 'dracula';
  url: string;
  score: number;
  depth: 'top-5' | 'full';
}

const COLORS = {
  ariada: { bg: '#0f172a', fg: '#f8fafc', accent: '#0ea5e9', score: '#1e40af' },
  dracula: { bg: '#1c0708', fg: '#f8d7da', accent: '#dc2626', score: '#7f1d1d' },
} as const;

const TONE = {
  ariada: 'Accessibility scan',
  dracula: 'Dracula scanned this site',
} as const;

/**
 *
 */
export function OgTemplate(props: OgProps): unknown {
  const c = COLORS[props.brand];
  const headline = TONE[props.brand];
  const scoreText = String(Math.round(props.score));
  const depthNote = props.depth === 'full' ? '' : ' (top-5 free)';
  const footer =
    props.brand === 'ariada'
      ? `Full report: ariada.org${depthNote}`
      : 'Powered by ariada.org — full report at ariada.org/pricing';
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '1200px',
        height: '630px',
        background: c.bg,
        color: c.fg,
        padding: '64px',
        fontFamily: 'sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: '36px',
              fontWeight: 600,
              color: c.accent,
              marginBottom: '24px',
            },
            children: headline,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: '28px',
              opacity: 0.85,
              marginBottom: '40px',
              wordBreak: 'break-all',
            },
            children: props.url,
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'baseline', gap: '24px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '240px',
                    fontWeight: 800,
                    color: c.score,
                    lineHeight: 1,
                  },
                  children: scoreText,
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', fontSize: '48px', opacity: 0.7 },
                  children: '/ 100',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              marginTop: 'auto',
              fontSize: '24px',
              opacity: 0.7,
            },
            children: footer,
          },
        },
      ],
    },
  };
}
