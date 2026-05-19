import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportOutcomeForm } from './_report-form.tsx';

const MOCK_INDICATORS = [
  {
    id: 'ind-uuid-1',
    code: '15.2.1',
    name: 'Progress towards sustainable forest management',
    unit: 'index score (0–100)',
    description: 'Composite index of sustainable forest management dimensions.',
  },
  {
    id: 'ind-uuid-2',
    code: '15.1.1',
    name: 'Forest area as a proportion of total land area',
    unit: 'percentage',
    description: 'Percentage of total land area covered by forest.',
  },
];

describe('ReportOutcomeForm', () => {
  it('renders the indicator select', () => {
    render(<ReportOutcomeForm groupId="group-uuid" indicators={MOCK_INDICATORS} />);
    expect(screen.getByRole('combobox', { name: /indicator/i })).toBeInTheDocument();
  });

  it('renders the value input', () => {
    render(<ReportOutcomeForm groupId="group-uuid" indicators={MOCK_INDICATORS} />);
    expect(screen.getByRole('spinbutton', { name: /value/i })).toBeInTheDocument();
  });

  it('renders the description textarea', () => {
    render(<ReportOutcomeForm groupId="group-uuid" indicators={MOCK_INDICATORS} />);
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<ReportOutcomeForm groupId="group-uuid" indicators={MOCK_INDICATORS} />);
    expect(screen.getByRole('button', { name: /report outcome/i })).toBeInTheDocument();
  });
});
