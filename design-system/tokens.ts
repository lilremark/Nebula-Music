export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
    // Backgrounds
    bg: string;
    bgSecondary: string;
    bgTertiary: string;

    // Text colors
    text: string;
    textSecondary: string;
    textTertiary: string;

    // Borders
    border: string;
    borderHover: string;

    // Interactive elements
    hover: string;
    active: string;

    // States
    muted: string;
}

export const lightColors: ThemeColors = {
    bg: '#f3f4f8',
    bgSecondary: '#e8eaf1',
    bgTertiary: '#d9dce7',
    text: '#191b27',
    textSecondary: '#515667',
    textTertiary: '#626778',
    border: '#d8dbe5',
    borderHover: '#b8bdca',
    hover: '#e8eaf1',
    active: '#d9dce7',
    muted: '#626778'
};

export const darkColors: ThemeColors = {
    bg: '#11131c',
    bgSecondary: '#181a25',
    bgTertiary: '#242735',
    text: '#f5f5fa',
    textSecondary: '#bcc0ce',
    textTertiary: '#abb0c0',
    border: '#333746',
    borderHover: '#4b5163',
    hover: '#242735',
    active: '#303446',
    muted: '#abb0c0'
};


export const themeColors = { light: lightColors, dark: darkColors };

/** Existing defaults from Store; user overrides remain supported. */
export const defaultAccent = { primaryColor: '#5368d8', secondaryColor: '#7b88e5', backgroundColor: '#11131c' };

/**
 * Studio is the tactile direction introduced by refinement E. These values are
 * intentionally separate from the current product tokens until adoption is
 * approved; the catalog and Studio preview are their consumers.
 */
export const studioTokens = {
    color: {
        dark: { canvas: '#171819', panel: '#1e2022', surface: '#26292b', cardTop: '#2d3032', inset: '#171a1c', control: '#303538', line: 'rgb(255 255 255 / 8%)', edge: 'rgb(255 255 255 / 12%)', text: '#f1f4f3', muted: '#a6adaa', faint: '#727a78', accent: '#95cbcb', accentInk: '#142021', positive: '#95cbcb', warning: '#d7b56d', danger: '#dc8f8c' },
        light: { canvas: '#dfe3e4', panel: '#e6eaeb', surface: '#edf1f2', cardTop: '#f7f9f9', inset: '#d7dee0', control: '#e8edef', line: 'rgb(33 59 70 / 12%)', edge: 'rgb(255 255 255 / 78%)', text: '#1c2729', muted: '#5f6a6d', faint: '#778286', accent: '#95cbcb', accentInk: '#142021', positive: '#397779', warning: '#865e19', danger: '#a44a49' },
    },
    type: { display: '32px / 1.04 / 600', title: '20px / 1.2 / 600', body: '14px / 1.45 / 500', supporting: '12px / 1.45 / 400', meta: '10px / 1.3 / 500' },
    space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px' },
    radius: { control: '14px', card: '16px', artwork: '22px', pill: '999px' },
    shadow: { raised: '0 3px 6px rgb(0 0 0 / 18%), 0 16px 24px -8px rgb(0 0 0 / 42%), inset 0 1px 0 rgb(255 255 255 / 4%)', inset: 'inset 0 2px 4px rgb(0 0 0 / 28%), 0 1px 0 rgb(255 255 255 / 8%)', float: '0 22px 32px -9px rgb(0 0 0 / 48%), inset 0 1px 0 rgb(255 255 255 / 8%)' },
    motion: { press: '120ms ease-out', control: '180ms ease', panel: '200ms ease', reduced: '0.01ms linear' },
} as const;
