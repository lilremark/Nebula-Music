import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import {
  BACKGROUND_OPTIONS,
  FONT_OPTIONS,
  THEME_PRESETS,
  getFontOption,
  getFontPreviewStylesheetUrl,
  type BackgroundId,
  type FontId,
  type ThemePresetId,
} from '../../constants/appearance';
import { ensureStylesheet } from '../../theme/applyAppearance';
import { CustomDropdown } from '../CustomDropdown';

/**
 * Font dropdown; every option renders in its own typeface. A single
 * subsetted Google Fonts request (only the glyphs of the names) is loaded
 * when this control first mounts; offline, names fall back to the system font.
 */
export const FontSelect: React.FC<{ value: FontId; onChange: (value: FontId) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  useEffect(() => { ensureStylesheet('font-previews', getFontPreviewStylesheetUrl()); }, []);
  return (
    <CustomDropdown
      ariaLabel="Font"
      clearable={false}
      disabled={disabled}
      value={value}
      onChange={next => onChange(getFontOption(next).id)}
      options={FONT_OPTIONS.map(font => ({ value: font.id, label: font.name }))}
      optionStyle={id => ({ fontFamily: getFontOption(id).stack })}
    />
  );
};

interface RadioCardOption<T extends string> {
  value: T;
  render: (checked: boolean) => React.ReactNode;
  label: string;
  description?: string;
  kind?: string;
}

/**
 * A radio group of cards with roving tabindex: Tab enters/leaves the group,
 * arrow keys / Home / End move and select (selection follows focus, as for
 * native radios).
 */
function RadioCardGroup<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly RadioCardOption<T>[];
  onChange: (value: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));

  const move = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': event.preventDefault(); move(index + 1); break;
      case 'ArrowLeft': case 'ArrowUp': event.preventDefault(); move(index - 1); break;
      case 'Home': event.preventDefault(); move(0); break;
      case 'End': event.preventDefault(); move(options.length - 1); break;
      default: break;
    }
  };

  return (
    <div role="radiogroup" aria-label={label} className="nebula-appearance-grid">
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={element => { refs.current[index] = element; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.description ? `${option.label}. ${option.description}` : option.label}
            tabIndex={index === selectedIndex ? 0 : -1}
            data-kind={option.kind}
            className="nebula-appearance-card"
            onClick={() => onChange(option.value)}
            onKeyDown={event => onKeyDown(event, index)}
          >
            {option.render(checked)}
          </button>
        );
      })}
    </div>
  );
}

const CardName: React.FC<{ name: string; checked: boolean }> = ({ name, checked }) => (
  <span className="nebula-appearance-card-name">
    <span>{name}</span>
    {checked && <Check aria-hidden="true" />}
  </span>
);

export const ThemePresetPicker: React.FC<{
  value: ThemePresetId;
  onChange: (value: ThemePresetId) => void;
  mode: 'light' | 'dark';
  /** User accent colours, shown on the default card. */
  accents: [string, string];
}> = ({ value, onChange, mode, accents }) => (
  <RadioCardGroup
    label="Theme"
    value={value}
    onChange={onChange}
    options={THEME_PRESETS.map(preset => {
      const chips = preset.id === 'default' ? [...preset.swatches[mode], accents[0]] : preset.swatches[mode];
      return {
        value: preset.id,
        label: preset.name,
        description: preset.description,
        kind: preset.kind,
        render: (checked: boolean) => (
          <>
            <span className="nebula-appearance-chips" aria-hidden="true">
              {chips.map((color, index) => <span key={index} style={{ background: color }} />)}
            </span>
            <CardName name={preset.name} checked={checked} />
          </>
        ),
      };
    })}
  />
);

export const BackgroundPicker: React.FC<{
  value: BackgroundId;
  onChange: (value: BackgroundId) => void;
}> = ({ value, onChange }) => (
  <RadioCardGroup
    label="Animated background"
    value={value}
    onChange={onChange}
    options={BACKGROUND_OPTIONS.map(option => ({
      value: option.id,
      label: option.name,
      description: option.description,
      render: (checked: boolean) => (
        <>
          <span className="nebula-bg-preview" data-variant={option.id} aria-hidden="true" />
          <CardName name={option.name} checked={checked} />
          <span className="nebula-appearance-card-desc">{option.description}</span>
        </>
      ),
    }))}
  />
);
