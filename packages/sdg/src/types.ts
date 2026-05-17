export type SdgId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;

export type SdgCode =
  | 'no-poverty'
  | 'zero-hunger'
  | 'good-health-well-being'
  | 'quality-education'
  | 'gender-equality'
  | 'clean-water-sanitation'
  | 'affordable-clean-energy'
  | 'decent-work-economic-growth'
  | 'industry-innovation-infrastructure'
  | 'reduced-inequalities'
  | 'sustainable-cities-communities'
  | 'responsible-consumption-production'
  | 'climate-action'
  | 'life-below-water'
  | 'life-on-land'
  | 'peace-justice-strong-institutions'
  | 'partnerships-for-the-goals';

export interface Sdg {
  /** Official UN goal number, 1–17. */
  readonly id: SdgId;
  /** URL-safe slug; stable identifier used in DB + URLs. */
  readonly code: SdgCode;
  /** Official English name (source of truth; i18n via nameKey). */
  readonly name: string;
  /** Single-word colloquial identifier used in dense UI. */
  readonly shortName: string;
  /** Official UN SDG color (hex). Source: UN SDG Communications Materials guidelines. */
  readonly color: string;
  /** Suggested foreground color when content sits atop `color`. */
  readonly onColor: '#FFFFFF' | '#000000';
  /** Icon identifier — resolved by @repo/design-system to an SVG path. */
  readonly iconRef: string;
  /** One-sentence English description (source of truth; i18n via descriptionKey). */
  readonly description: string;
  /** next-intl translation key for the goal name. */
  readonly nameKey: string;
  /** next-intl translation key for the description. */
  readonly descriptionKey: string;
  /** UN page listing this goal's official indicators. */
  readonly indicatorsUrl: string;
}
