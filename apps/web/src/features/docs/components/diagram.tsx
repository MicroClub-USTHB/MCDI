import Image from 'next/image';

interface DiagramProps {
  /** The light version in `public/docs/`; its dark twin is the same name ending in `-dark.svg`. */
  src: string;
  /** Required: say what the diagram shows, for people who cannot see it. */
  alt: string;
  width: number;
  height: number;
}

/** The dark twin of a diagram: `/docs/x.svg` → `/docs/x-dark.svg`. */
export function darkVariant(src: string): string {
  return src.replace(/\.svg$/, '-dark.svg');
}

/**
 * A static SVG from `public/docs/`, drawn in the mcoli-ui palette. An <img> cannot read the
 * page's theme, so each diagram ships a light and a dark file and CSS shows the one that
 * matches. Not optimised: an SVG is already as small as it gets.
 */
export function Diagram({ src, alt, width, height }: DiagramProps) {
  const className = 'h-auto w-full rounded-lg border border-border bg-card';
  return (
    <figure className="my-6">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        className={`${className} dark:hidden`}
      />
      <Image
        src={darkVariant(src)}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        className={`${className} hidden dark:block`}
      />
    </figure>
  );
}
