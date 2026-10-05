import Image from 'next/image';

interface DiagramProps {
  src: string;
  /** Required: say what the diagram shows, for people who cannot see it. */
  alt: string;
  width: number;
  height: number;
}

/** A static SVG from `public/docs/`. Not optimised: an SVG is already as small as it gets. */
export function Diagram({ src, alt, width, height }: DiagramProps) {
  return (
    <figure className="my-6">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        className="h-auto w-full rounded-lg border border-border bg-surface-raised"
      />
    </figure>
  );
}
