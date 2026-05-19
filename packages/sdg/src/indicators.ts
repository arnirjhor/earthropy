// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Static metadata for a curated subset of UN SDG indicators (~2 per goal).
// Source: https://unstats.un.org/sdgs/indicators/indicators-list/
//
// NOTE: These are the ~34 most community-actionable indicators, not the full
// ~230. Self-reported values on this platform are NOT externally verified.
// All numbers are self-attested by the reporting group.

import type { SdgId } from './types.ts';

export interface SdgIndicator {
  readonly id: string;
  readonly sdgId: SdgId;
  /** Official UN indicator code, e.g. "1.2.1" */
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly description: string;
}

export const INDICATORS: readonly SdgIndicator[] = [
  // SDG 1 — No Poverty
  {
    id: 'sdg-1-1-1',
    sdgId: 1,
    code: '1.1.1',
    name: 'Proportion of population below international poverty line',
    unit: 'percentage',
    description: 'Percentage of population living on less than $2.15/day (2017 PPP).',
  },
  {
    id: 'sdg-1-2-1',
    sdgId: 1,
    code: '1.2.1',
    name: 'Proportion of population living below national poverty line',
    unit: 'percentage',
    description: 'Percentage of population living below the national poverty line.',
  },
  // SDG 2 — Zero Hunger
  {
    id: 'sdg-2-1-1',
    sdgId: 2,
    code: '2.1.1',
    name: 'Prevalence of undernourishment',
    unit: 'percentage',
    description:
      'Percentage of population with caloric intake below minimum dietary energy requirement.',
  },
  {
    id: 'sdg-2-2-1',
    sdgId: 2,
    code: '2.2.1',
    name: 'Prevalence of stunting among children under 5',
    unit: 'percentage',
    description: 'Percentage of children under 5 with height-for-age below -2 standard deviations.',
  },
  // SDG 3 — Good Health and Well-Being
  {
    id: 'sdg-3-1-1',
    sdgId: 3,
    code: '3.1.1',
    name: 'Maternal mortality ratio',
    unit: 'per 100,000 live births',
    description: 'Number of maternal deaths per 100,000 live births.',
  },
  {
    id: 'sdg-3-8-1',
    sdgId: 3,
    code: '3.8.1',
    name: 'Coverage of essential health services',
    unit: 'index score (0–100)',
    description: 'Universal health coverage index based on tracer interventions.',
  },
  // SDG 4 — Quality Education
  {
    id: 'sdg-4-1-1',
    sdgId: 4,
    code: '4.1.1',
    name: 'Proportion of children achieving minimum proficiency in reading',
    unit: 'percentage',
    description:
      'Percentage of children at end of primary achieving minimum proficiency in reading.',
  },
  {
    id: 'sdg-4-6-1',
    sdgId: 4,
    code: '4.6.1',
    name: 'Literacy rate of population 15–24 years',
    unit: 'percentage',
    description: 'Percentage of people aged 15–24 who can read and write.',
  },
  // SDG 5 — Gender Equality
  {
    id: 'sdg-5-5-1',
    sdgId: 5,
    code: '5.5.1',
    name: 'Proportion of seats held by women in national parliament',
    unit: 'percentage',
    description: 'Percentage of parliamentary seats in a single or lower chamber held by women.',
  },
  {
    id: 'sdg-5-b-1',
    sdgId: 5,
    code: '5.b.1',
    name: 'Proportion of women who own a mobile telephone',
    unit: 'percentage',
    description: 'Percentage of women who own a mobile telephone.',
  },
  // SDG 6 — Clean Water and Sanitation
  {
    id: 'sdg-6-1-1',
    sdgId: 6,
    code: '6.1.1',
    name: 'Proportion of population using safely managed drinking water',
    unit: 'percentage',
    description: 'Percentage of population using safely managed drinking water services.',
  },
  {
    id: 'sdg-6-2-1',
    sdgId: 6,
    code: '6.2.1',
    name: 'Proportion of population using safely managed sanitation services',
    unit: 'percentage',
    description:
      'Percentage of population using safely managed sanitation services including handwashing.',
  },
  // SDG 7 — Affordable and Clean Energy
  {
    id: 'sdg-7-1-1',
    sdgId: 7,
    code: '7.1.1',
    name: 'Proportion of population with access to electricity',
    unit: 'percentage',
    description: 'Percentage of population with access to electricity.',
  },
  {
    id: 'sdg-7-2-1',
    sdgId: 7,
    code: '7.2.1',
    name: 'Renewable energy share in total final energy consumption',
    unit: 'percentage',
    description: 'Percentage of renewable energy in total final energy consumption.',
  },
  // SDG 8 — Decent Work and Economic Growth
  {
    id: 'sdg-8-5-2',
    sdgId: 8,
    code: '8.5.2',
    name: 'Unemployment rate',
    unit: 'percentage',
    description: 'Percentage of labor force that is unemployed.',
  },
  {
    id: 'sdg-8-10-1',
    sdgId: 8,
    code: '8.10.1',
    name: 'Adults with a bank account',
    unit: 'per 100,000 adults',
    description: 'Number of commercial bank branches and ATMs per 100,000 adults.',
  },
  // SDG 9 — Industry, Innovation and Infrastructure
  {
    id: 'sdg-9-1-2',
    sdgId: 9,
    code: '9.1.2',
    name: 'Passenger and freight volumes',
    unit: 'passenger-km / tonne-km',
    description: 'Total air and road passenger and freight volumes.',
  },
  {
    id: 'sdg-9-c-1',
    sdgId: 9,
    code: '9.c.1',
    name: 'Proportion of population covered by a mobile network',
    unit: 'percentage',
    description: 'Percentage of population covered by at least a 4G mobile network.',
  },
  // SDG 10 — Reduced Inequalities
  {
    id: 'sdg-10-1-1',
    sdgId: 10,
    code: '10.1.1',
    name: 'Growth rates of household income of the bottom 40%',
    unit: 'percentage',
    description: 'Growth rates of per capita household income of the bottom 40% of the population.',
  },
  {
    id: 'sdg-10-7-2',
    sdgId: 10,
    code: '10.7.2',
    name: 'Countries with migration policies facilitating orderly migration',
    unit: 'count',
    description:
      'Number of countries with migration policies facilitating orderly and safe migration.',
  },
  // SDG 11 — Sustainable Cities and Communities
  {
    id: 'sdg-11-1-1',
    sdgId: 11,
    code: '11.1.1',
    name: 'Proportion of population living in slums',
    unit: 'percentage',
    description: 'Percentage of urban population living in slum households.',
  },
  {
    id: 'sdg-11-6-2',
    sdgId: 11,
    code: '11.6.2',
    name: 'Annual mean PM2.5 concentration in cities',
    unit: 'µg/m³',
    description: 'Annual mean concentration of fine particulate matter (PM2.5) in cities.',
  },
  // SDG 12 — Responsible Consumption and Production
  {
    id: 'sdg-12-2-2',
    sdgId: 12,
    code: '12.2.2',
    name: 'Domestic material consumption per capita',
    unit: 'tonnes per capita',
    description: 'Total amount of materials used domestically per person per year.',
  },
  {
    id: 'sdg-12-5-1',
    sdgId: 12,
    code: '12.5.1',
    name: 'National recycling rate',
    unit: 'percentage',
    description: 'Percentage of material flows that are recycled.',
  },
  // SDG 13 — Climate Action
  {
    id: 'sdg-13-2-2',
    sdgId: 13,
    code: '13.2.2',
    name: 'Total greenhouse gas emissions per year',
    unit: 'megatonnes CO₂ equivalent',
    description: 'Annual total greenhouse gas emissions in megatonnes of CO₂ equivalent.',
  },
  {
    id: 'sdg-13-3-1',
    sdgId: 13,
    code: '13.3.1',
    name: 'Countries integrating climate change mitigation into policies',
    unit: 'count',
    description: 'Number of countries with policies addressing climate change mitigation.',
  },
  // SDG 14 — Life Below Water
  {
    id: 'sdg-14-1-1',
    sdgId: 14,
    code: '14.1.1',
    name: 'Index of coastal eutrophication and floating plastic debris',
    unit: 'index score',
    description: 'Composite index measuring coastal eutrophication and marine plastic litter.',
  },
  {
    id: 'sdg-14-5-1',
    sdgId: 14,
    code: '14.5.1',
    name: 'Coverage of protected areas in relation to marine areas',
    unit: 'percentage',
    description: 'Percentage of marine areas designated as protected.',
  },
  // SDG 15 — Life on Land
  {
    id: 'sdg-15-1-1',
    sdgId: 15,
    code: '15.1.1',
    name: 'Forest area as a proportion of total land area',
    unit: 'percentage',
    description: 'Percentage of total land area covered by forest.',
  },
  {
    id: 'sdg-15-2-1',
    sdgId: 15,
    code: '15.2.1',
    name: 'Progress towards sustainable forest management',
    unit: 'index score (0–100)',
    description: 'Composite index of sustainable forest management dimensions.',
  },
  // SDG 16 — Peace, Justice and Strong Institutions
  {
    id: 'sdg-16-1-1',
    sdgId: 16,
    code: '16.1.1',
    name: 'Number of victims of intentional homicide per 100,000 population',
    unit: 'per 100,000 population',
    description: 'Rate of intentional homicide victims per 100,000 population.',
  },
  {
    id: 'sdg-16-6-1',
    sdgId: 16,
    code: '16.6.1',
    name: 'Primary government expenditures as a proportion of original approved budget',
    unit: 'percentage',
    description: 'Percentage of primary government expenditures relative to approved budget.',
  },
  // SDG 17 — Partnerships for the Goals
  {
    id: 'sdg-17-8-1',
    sdgId: 17,
    code: '17.8.1',
    name: 'Proportion of individuals using the internet',
    unit: 'percentage',
    description: 'Percentage of individuals who have used the internet in the last 3 months.',
  },
  {
    id: 'sdg-17-19-2',
    sdgId: 17,
    code: '17.19.2',
    name: 'Countries with completed birth and death registration',
    unit: 'percentage',
    description: 'Percentage of countries that have achieved 100% birth and death registration.',
  },
] as const;

const BY_ID = new Map<string, SdgIndicator>(INDICATORS.map((i) => [i.id, i]));
const BY_CODE = new Map<string, SdgIndicator>(INDICATORS.map((i) => [i.code, i]));
const BY_SDG = new Map<SdgId, SdgIndicator[]>();

for (const indicator of INDICATORS) {
  const existing = BY_SDG.get(indicator.sdgId) ?? [];
  existing.push(indicator);
  BY_SDG.set(indicator.sdgId, existing);
}

export function getIndicatorById(id: string): SdgIndicator {
  const indicator = BY_ID.get(id);
  if (!indicator) throw new Error(`Unknown indicator id: ${id}`);
  return indicator;
}

export function getIndicatorByCode(code: string): SdgIndicator {
  const indicator = BY_CODE.get(code);
  if (!indicator) throw new Error(`Unknown indicator code: ${code}`);
  return indicator;
}

export function getIndicatorsBySdgId(sdgId: SdgId): readonly SdgIndicator[] {
  return BY_SDG.get(sdgId) ?? [];
}
