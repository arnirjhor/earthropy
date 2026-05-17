import type { Sdg, SdgCode, SdgId } from './types.ts';

// Source of truth for the 17 SDGs. Colors and names follow the UN's official
// SDG Communications Materials. Modifying this file changes a load-bearing
// taxonomy — coordinate with the docs site and i18n catalogs.
export const SDGS: readonly Sdg[] = [
  {
    id: 1,
    code: 'no-poverty',
    name: 'No Poverty',
    shortName: 'Poverty',
    color: '#E5243B',
    onColor: '#FFFFFF',
    iconRef: 'sdg/01-no-poverty',
    description: 'End poverty in all its forms everywhere.',
    nameKey: 'sdg.1.name',
    descriptionKey: 'sdg.1.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=1',
  },
  {
    id: 2,
    code: 'zero-hunger',
    name: 'Zero Hunger',
    shortName: 'Hunger',
    color: '#DDA63A',
    onColor: '#FFFFFF',
    iconRef: 'sdg/02-zero-hunger',
    description:
      'End hunger, achieve food security and improved nutrition, and promote sustainable agriculture.',
    nameKey: 'sdg.2.name',
    descriptionKey: 'sdg.2.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=2',
  },
  {
    id: 3,
    code: 'good-health-well-being',
    name: 'Good Health and Well-Being',
    shortName: 'Health',
    color: '#4C9F38',
    onColor: '#FFFFFF',
    iconRef: 'sdg/03-good-health-well-being',
    description: 'Ensure healthy lives and promote well-being for all at all ages.',
    nameKey: 'sdg.3.name',
    descriptionKey: 'sdg.3.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=3',
  },
  {
    id: 4,
    code: 'quality-education',
    name: 'Quality Education',
    shortName: 'Education',
    color: '#C5192D',
    onColor: '#FFFFFF',
    iconRef: 'sdg/04-quality-education',
    description:
      'Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.',
    nameKey: 'sdg.4.name',
    descriptionKey: 'sdg.4.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=4',
  },
  {
    id: 5,
    code: 'gender-equality',
    name: 'Gender Equality',
    shortName: 'Equality',
    color: '#FF3A21',
    onColor: '#FFFFFF',
    iconRef: 'sdg/05-gender-equality',
    description: 'Achieve gender equality and empower all women and girls.',
    nameKey: 'sdg.5.name',
    descriptionKey: 'sdg.5.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=5',
  },
  {
    id: 6,
    code: 'clean-water-sanitation',
    name: 'Clean Water and Sanitation',
    shortName: 'Water',
    color: '#26BDE2',
    onColor: '#FFFFFF',
    iconRef: 'sdg/06-clean-water-sanitation',
    description: 'Ensure availability and sustainable management of water and sanitation for all.',
    nameKey: 'sdg.6.name',
    descriptionKey: 'sdg.6.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=6',
  },
  {
    id: 7,
    code: 'affordable-clean-energy',
    name: 'Affordable and Clean Energy',
    shortName: 'Energy',
    color: '#FCC30B',
    onColor: '#000000',
    iconRef: 'sdg/07-affordable-clean-energy',
    description: 'Ensure access to affordable, reliable, sustainable and modern energy for all.',
    nameKey: 'sdg.7.name',
    descriptionKey: 'sdg.7.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=7',
  },
  {
    id: 8,
    code: 'decent-work-economic-growth',
    name: 'Decent Work and Economic Growth',
    shortName: 'Work',
    color: '#A21942',
    onColor: '#FFFFFF',
    iconRef: 'sdg/08-decent-work-economic-growth',
    description:
      'Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all.',
    nameKey: 'sdg.8.name',
    descriptionKey: 'sdg.8.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=8',
  },
  {
    id: 9,
    code: 'industry-innovation-infrastructure',
    name: 'Industry, Innovation and Infrastructure',
    shortName: 'Industry',
    color: '#FD6925',
    onColor: '#FFFFFF',
    iconRef: 'sdg/09-industry-innovation-infrastructure',
    description:
      'Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation.',
    nameKey: 'sdg.9.name',
    descriptionKey: 'sdg.9.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=9',
  },
  {
    id: 10,
    code: 'reduced-inequalities',
    name: 'Reduced Inequalities',
    shortName: 'Inequality',
    color: '#DD1367',
    onColor: '#FFFFFF',
    iconRef: 'sdg/10-reduced-inequalities',
    description: 'Reduce inequality within and among countries.',
    nameKey: 'sdg.10.name',
    descriptionKey: 'sdg.10.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=10',
  },
  {
    id: 11,
    code: 'sustainable-cities-communities',
    name: 'Sustainable Cities and Communities',
    shortName: 'Cities',
    color: '#FD9D24',
    onColor: '#FFFFFF',
    iconRef: 'sdg/11-sustainable-cities-communities',
    description: 'Make cities and human settlements inclusive, safe, resilient and sustainable.',
    nameKey: 'sdg.11.name',
    descriptionKey: 'sdg.11.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=11',
  },
  {
    id: 12,
    code: 'responsible-consumption-production',
    name: 'Responsible Consumption and Production',
    shortName: 'Consumption',
    color: '#BF8B2E',
    onColor: '#FFFFFF',
    iconRef: 'sdg/12-responsible-consumption-production',
    description: 'Ensure sustainable consumption and production patterns.',
    nameKey: 'sdg.12.name',
    descriptionKey: 'sdg.12.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=12',
  },
  {
    id: 13,
    code: 'climate-action',
    name: 'Climate Action',
    shortName: 'Climate',
    color: '#3F7E44',
    onColor: '#FFFFFF',
    iconRef: 'sdg/13-climate-action',
    description: 'Take urgent action to combat climate change and its impacts.',
    nameKey: 'sdg.13.name',
    descriptionKey: 'sdg.13.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=13',
  },
  {
    id: 14,
    code: 'life-below-water',
    name: 'Life Below Water',
    shortName: 'Oceans',
    color: '#0A97D9',
    onColor: '#FFFFFF',
    iconRef: 'sdg/14-life-below-water',
    description:
      'Conserve and sustainably use the oceans, seas and marine resources for sustainable development.',
    nameKey: 'sdg.14.name',
    descriptionKey: 'sdg.14.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=14',
  },
  {
    id: 15,
    code: 'life-on-land',
    name: 'Life on Land',
    shortName: 'Land',
    color: '#56C02B',
    onColor: '#FFFFFF',
    iconRef: 'sdg/15-life-on-land',
    description:
      'Protect, restore and promote sustainable use of terrestrial ecosystems, sustainably manage forests, combat desertification, and halt and reverse land degradation and halt biodiversity loss.',
    nameKey: 'sdg.15.name',
    descriptionKey: 'sdg.15.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=15',
  },
  {
    id: 16,
    code: 'peace-justice-strong-institutions',
    name: 'Peace, Justice and Strong Institutions',
    shortName: 'Peace',
    color: '#00689D',
    onColor: '#FFFFFF',
    iconRef: 'sdg/16-peace-justice-strong-institutions',
    description:
      'Promote peaceful and inclusive societies for sustainable development, provide access to justice for all and build effective, accountable and inclusive institutions at all levels.',
    nameKey: 'sdg.16.name',
    descriptionKey: 'sdg.16.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=16',
  },
  {
    id: 17,
    code: 'partnerships-for-the-goals',
    name: 'Partnerships for the Goals',
    shortName: 'Partnerships',
    color: '#19486A',
    onColor: '#FFFFFF',
    iconRef: 'sdg/17-partnerships-for-the-goals',
    description:
      'Strengthen the means of implementation and revitalize the global partnership for sustainable development.',
    nameKey: 'sdg.17.name',
    descriptionKey: 'sdg.17.description',
    indicatorsUrl: 'https://unstats.un.org/sdgs/metadata/?Goal=17',
  },
] as const;

const BY_ID = new Map<SdgId, Sdg>(SDGS.map((s) => [s.id, s]));
const BY_CODE = new Map<SdgCode, Sdg>(SDGS.map((s) => [s.code, s]));

export function getSdgById(id: SdgId): Sdg {
  const sdg = BY_ID.get(id);
  if (!sdg) throw new Error(`Unknown SDG id: ${id satisfies never}`);
  return sdg;
}

export function getSdgByCode(code: SdgCode): Sdg {
  const sdg = BY_CODE.get(code);
  if (!sdg) throw new Error(`Unknown SDG code: ${code satisfies never}`);
  return sdg;
}

export function isSdgId(value: unknown): value is SdgId {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 17;
}

export function isSdgCode(value: unknown): value is SdgCode {
  return typeof value === 'string' && BY_CODE.has(value as SdgCode);
}
