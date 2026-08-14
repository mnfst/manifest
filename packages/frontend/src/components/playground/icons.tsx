import type { Component, JSX } from 'solid-js';

interface IconProps {
  size?: number;
  class?: string;
}

function svgProps(size: number, className?: string): JSX.SvgSVGAttributes<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: className,
  };
}

/**
 * Small set of inline SVG icons for the Playground page. The project's bundled
 * boxicons font only contains 5 glyphs (check-circle, florist, info-circle,
 * message-bubble-detail, x-circle) and the CSP disallows loading icon CDNs —
 * so we inline the rest.
 */

export const XIcon: Component<IconProps> = (props) => (
  <svg {...svgProps(props.size ?? 16, props.class)}>
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

export const PlusIcon: Component<IconProps> = (props) => (
  <svg {...svgProps(props.size ?? 16, props.class)}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

export const TrashIcon: Component<IconProps> = (props) => (
  <svg {...svgProps(props.size ?? 16, props.class)}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

export const HistoryIcon: Component<IconProps> = (props) => (
  <svg {...svgProps(props.size ?? 16, props.class)}>
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export const CodeIcon: Component<IconProps> = (props) => (
  <svg {...svgProps(props.size ?? 16, props.class)}>
    <path d="M16 18l6-6-6-6" />
    <path d="M8 6l-6 6 6 6" />
  </svg>
);
