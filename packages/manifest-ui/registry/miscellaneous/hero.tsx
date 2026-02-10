'use client';

import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
import { demoHeroDefault } from './demo/miscellaneous';

/**
 * Represents a logo in the hero section.
 * @interface HeroLogo
 * @property {string} [url] - URL of the logo image (shown in light mode)
 * @property {string} [urlLight] - URL of the light version logo (shown in dark mode for visibility)
 * @property {string} [alt] - Alt text for the logo
 * @property {string} [text] - Text to display if no URL is provided (e.g., "Acme")
 */
export interface HeroLogo {
  url?: string;
  urlLight?: string;
  alt?: string;
  text?: string;
}

/**
 * Represents a tech/partner logo in the footer section.
 * @interface TechLogo
 * @property {string} [url] - URL of the tech logo image
 * @property {string} [alt] - Alt text for the logo
 * @property {string} [name] - Name of the technology (used for tooltip)
 */
export interface TechLogo {
  url?: string;
  alt?: string;
  name?: string;
}

/**
 * Represents a button configuration in the hero section.
 * @interface HeroButton
 * @property {string} [label] - Text label for the button (optional)
 * @property {ReactNode} [icon] - Icon to display in the button (optional)
 */
export interface HeroButton {
  label?: string;
  icon?: ReactNode;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HeroProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for the Hero component. A landing hero section with optional logos,
 * title, subtitle, call-to-action buttons, and tech logos footer.
 */
export interface HeroProps {
  data?: {
    /** Primary logo displayed in the hero. Can be an image URL or text. */
    logo1?: HeroLogo;
    /** Secondary logo displayed next to the primary logo (shows separator between them). */
    logo2?: HeroLogo;
    /** Separator text between logos (e.g., "x", "&", "and"). Only shown when both logos are present. */
    logoSeparator?: string;
    /** Main title/heading of the hero section. */
    title?: string;
    /** Subtitle or description text below the title. */
    subtitle?: string;
    /** Primary button configuration with optional label and icon. */
    primaryButton?: HeroButton;
    /** Secondary button configuration with optional label and icon. */
    secondaryButton?: HeroButton;
    /** Label text above the tech logos (e.g., "Built with open-source technologies"). */
    techLogosLabel?: string;
    /** Array of tech/partner logos to display in the footer section. */
    techLogos?: TechLogo[];
  };
  actions?: {
    /** Called when the primary button is clicked. */
    onPrimaryClick?: () => void;
    /** Called when the secondary button is clicked. */
    onSecondaryClick?: () => void;
  };
}


/**
 * Renders a logo - image logos display directly, text logos get a bordered container
 * Supports light/dark mode variants for image logos
 */
function LogoDisplay({ logo }: { logo: HeroLogo }) {
  // Image logos display directly without a container
  if (logo.url) {
    // If urlLight is provided, show different logos for light/dark mode
    if (logo.urlLight) {
      return (
        <>
          <img
            src={logo.url}
            alt={logo.alt || 'Logo'}
            className="h-8 sm:h-10 w-auto object-contain dark:hidden"
          />
          <img
            src={logo.urlLight}
            alt={logo.alt || 'Logo'}
            className="h-8 sm:h-10 w-auto object-contain hidden dark:block"
          />
        </>
      );
    }
    // Single logo for both modes
    return (
      <img src={logo.url} alt={logo.alt || 'Logo'} className="h-16 sm:h-20 w-auto object-contain" />
    );
  }
  // Text logos get a bordered square container
  if (logo.text) {
    return (
      <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border bg-background p-3">
        <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          {logo.text}
        </span>
      </div>
    );
  }
  return null;
}

/**
 * A landing hero section with optional logos, title, subtitle,
 * call-to-action buttons, and tech logos footer.
 *
 * Features:
 * - One or two logos with optional separator (x, &, etc.)
 * - Logos can be images or text
 * - Main title and subtitle text
 * - Primary (outline) and secondary (filled) CTA buttons with optional icons
 * - Optional tech/partner logos footer section
 * - All fields are optional with graceful degradation
 * - Full-width card layout with proper spacing
 * - Works in both light and dark mode
 *
 * @component
 * @example
 * ```tsx
 * <Hero
 *   data={{
 *     logo1: { url: "/logo.svg", alt: "My App" },
 *     title: "Welcome to My App",
 *     subtitle: "The best app for doing things",
 *     primaryButton: { label: "Get Started" },
 *     secondaryButton: { label: "GitHub", icon: <Github className="h-5 w-5" /> }
 *   }}
 *   actions={{
 *     onPrimaryClick: () => console.log("Primary clicked"),
 *     onSecondaryClick: () => console.log("Secondary clicked")
 *   }}
 * />
 * ```
 */
export function Hero({ data, actions }: HeroProps) {
  const resolved: NonNullable<HeroProps['data']> = data ?? demoHeroDefault;
  const logo1 = resolved?.logo1;
  const logo2 = resolved?.logo2;
  const logoSeparator = resolved?.logoSeparator ?? 'x';
  const title = resolved?.title;
  const subtitle = resolved?.subtitle;
  const primaryButton = resolved?.primaryButton;
  const secondaryButton = resolved?.secondaryButton;
  const techLogosLabel = resolved?.techLogosLabel;
  const techLogos = resolved?.techLogos;

  const hasLogo1 = logo1?.url || logo1?.text;
  const hasLogo2 = logo2?.url || logo2?.text;
  const hasLogos = hasLogo1 || hasLogo2;
  const hasBothLogos = hasLogo1 && hasLogo2;
  const hasPrimaryButton = primaryButton?.label || primaryButton?.icon;
  const hasSecondaryButton = secondaryButton?.label || secondaryButton?.icon;
  const hasButtons = hasPrimaryButton || hasSecondaryButton;
  const hasTechLogos = techLogos && techLogos.length > 0;

  return (
    <div className="w-full rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col items-center justify-center py-16 sm:py-20 lg:py-24 px-6 sm:px-8 lg:px-12">
        {/* Logos Section */}
        {hasLogos && (
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-10">
            {hasLogo1 && <LogoDisplay logo={logo1} />}
            {hasBothLogos && (
              <span className="text-lg sm:text-xl font-medium text-muted-foreground">
                {logoSeparator}
              </span>
            )}
            {hasLogo2 && logo2 && <LogoDisplay logo={logo2} />}
          </div>
        )}

        {/* Title */}
        {title && (
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground text-center max-w-4xl mb-4 sm:mb-6">
            {title}
          </h1>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="text-base sm:text-lg text-muted-foreground text-center max-w-2xl mb-8 sm:mb-10">
            {subtitle}
          </p>
        )}

        {/* Buttons */}
        {hasButtons && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            {hasPrimaryButton && (
              <Button
                variant="outline"
                size="lg"
                className="min-w-[140px]"
                onClick={actions?.onPrimaryClick}
              >
                {primaryButton.icon && <span className="mr-2">{primaryButton.icon}</span>}
                {primaryButton.label}
              </Button>
            )}
            {hasSecondaryButton && (
              <Button size="lg" className="min-w-[140px]" onClick={actions?.onSecondaryClick}>
                {secondaryButton.icon && <span className="mr-2">{secondaryButton.icon}</span>}
                {secondaryButton.label}
              </Button>
            )}
          </div>
        )}

        {/* Tech Logos Footer */}
        {hasTechLogos && (
          <div className="flex flex-col items-center mt-12 sm:mt-16 pt-8 sm:pt-10 border-t w-full max-w-2xl">
            {techLogosLabel && (
              <p className="text-sm text-muted-foreground mb-4">{techLogosLabel}</p>
            )}
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {techLogos.map((logo) => (
                <div
                  key={logo.name || logo.url || logo.alt}
                  className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg border bg-background p-2"
                  title={logo.name}
                >
                  {logo.url && (
                    <img
                      src={logo.url}
                      alt={logo.alt || logo.name || 'Tech logo'}
                      className="max-w-full max-h-full object-contain opacity-60 grayscale"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
