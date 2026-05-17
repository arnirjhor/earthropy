import { SDGS } from '@repo/sdg';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SdgMultiSelect } from './SdgMultiSelect.tsx';

// Only use first 4 SDGs for brevity in tests
const testSdgs = SDGS.slice(0, 4);

describe('SdgMultiSelect', () => {
  it('renders all provided SDG chips', () => {
    render(<SdgMultiSelect sdgs={testSdgs} namePrefix="sdg" />);
    for (const sdg of testSdgs) {
      expect(screen.getByRole('checkbox', { name: new RegExp(`SDG ${sdg.id}`) })).toBeTruthy();
    }
  });

  it('selecting a chip marks it as checked', async () => {
    const user = userEvent.setup();
    render(<SdgMultiSelect sdgs={testSdgs} namePrefix="sdg" />);

    const chip1Checkbox = screen.getByRole('checkbox', { name: /SDG 1/ });
    expect(chip1Checkbox).not.toBeChecked();

    await user.click(chip1Checkbox);
    expect(chip1Checkbox).toBeChecked();
  });

  it('deselecting a chip unchecks it', async () => {
    const user = userEvent.setup();
    render(<SdgMultiSelect sdgs={testSdgs} namePrefix="sdg" />);

    const chip1Checkbox = screen.getByRole('checkbox', { name: /SDG 1/ });
    await user.click(chip1Checkbox); // select
    await user.click(chip1Checkbox); // deselect
    expect(chip1Checkbox).not.toBeChecked();
  });

  it('clicking radio handle on a selected chip sets it as primary', async () => {
    const user = userEvent.setup();
    render(<SdgMultiSelect sdgs={testSdgs} namePrefix="sdg" />);

    // Select SDG 1 and SDG 2
    await user.click(screen.getByRole('checkbox', { name: /SDG 1/ }));
    await user.click(screen.getByRole('checkbox', { name: /SDG 2/ }));

    // SDG 1 should be primary (first selected)
    const primary1 = screen.getByRole('radio', { name: /primary.*SDG 1/i });
    expect(primary1).toBeChecked();

    // Click SDG 2 radio to make it primary
    const primary2 = screen.getByRole('radio', { name: /primary.*SDG 2/i });
    await user.click(primary2);
    expect(primary2).toBeChecked();
    expect(primary1).not.toBeChecked();
  });

  it('only one primary at a time', async () => {
    const user = userEvent.setup();
    render(<SdgMultiSelect sdgs={testSdgs} namePrefix="sdg" />);

    await user.click(screen.getByRole('checkbox', { name: /SDG 1/ }));
    await user.click(screen.getByRole('checkbox', { name: /SDG 2/ }));
    await user.click(screen.getByRole('checkbox', { name: /SDG 3/ }));

    // Make SDG 3 primary
    await user.click(screen.getByRole('radio', { name: /primary.*SDG 3/i }));

    const primaryRadios = screen
      .getAllByRole('radio')
      .filter((r): r is HTMLInputElement => (r as HTMLInputElement).checked);

    expect(primaryRadios.length).toBe(1);
    expect((primaryRadios[0] as HTMLInputElement).value).toBe('3');
  });

  it('deselecting a primary chip promotes another selected chip to primary', async () => {
    const user = userEvent.setup();
    render(<SdgMultiSelect sdgs={testSdgs} namePrefix="sdg" />);

    await user.click(screen.getByRole('checkbox', { name: /SDG 1/ }));
    await user.click(screen.getByRole('checkbox', { name: /SDG 2/ }));

    // SDG 1 is primary; deselect it
    await user.click(screen.getByRole('checkbox', { name: /SDG 1/ }));

    // SDG 2 should now be primary
    const primary2 = screen.getByRole('radio', { name: /primary.*SDG 2/i });
    expect(primary2).toBeChecked();
  });

  it('produces correct hidden input field names in form-data shape', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form data-testid="form">
        <SdgMultiSelect sdgs={testSdgs} namePrefix="sdg" />
      </form>,
    );

    await user.click(screen.getByRole('checkbox', { name: /SDG 1/ }));
    await user.click(screen.getByRole('checkbox', { name: /SDG 2/ }));

    const form = container.querySelector('form') as HTMLFormElement;
    const formData = new FormData(form);

    // primarySdgId is a single value
    expect(formData.get('primarySdgId')).toBe('1');

    // additionalSdgIds is a JSON array of the non-primary selected IDs
    const additional = JSON.parse(formData.get('additionalSdgIds') as string) as number[];
    expect(additional).toContain(2);
    expect(additional).not.toContain(1);
  });

  it('renders radio handles only for selected chips', async () => {
    const user = userEvent.setup();
    render(<SdgMultiSelect sdgs={testSdgs} namePrefix="sdg" />);

    // No radio handles visible initially
    expect(screen.queryAllByRole('radio').length).toBe(0);

    await user.click(screen.getByRole('checkbox', { name: /SDG 1/ }));

    // One radio for SDG 1
    expect(screen.getAllByRole('radio').length).toBe(1);

    await user.click(screen.getByRole('checkbox', { name: /SDG 2/ }));

    // Two radios now
    expect(screen.getAllByRole('radio').length).toBe(2);
  });

  it('works with defaultSelectedIds and defaultPrimaryId props', () => {
    render(
      <SdgMultiSelect
        sdgs={testSdgs}
        namePrefix="sdg"
        defaultSelectedIds={[2, 3]}
        defaultPrimaryId={3}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /SDG 2/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /SDG 3/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /SDG 1/ })).not.toBeChecked();

    const primary3 = screen.getByRole('radio', { name: /primary.*SDG 3/i });
    expect(primary3).toBeChecked();
  });
});
