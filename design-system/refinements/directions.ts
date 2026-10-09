export const directions = [
  { id: 'A', name: 'Graphite', character: 'Crisp & elevated', description: 'A close refinement: crisp 10px cards, tight layered shadows, and confident semibold type.', shape: '10px corners', depth: 'Tight drop shadow', motion: '160ms · 2px lift' },
  { id: 'B', name: 'Contour', character: 'Soft & sculpted', description: 'Softly sculpted surfaces with 20px corners, broad shadows, and comfortable, rounded controls.', shape: '20px corners', depth: 'Broad soft shadow', motion: '240ms · 3px lift' },
  { id: 'C', name: 'Precision', character: 'Compact & defined', description: 'A precise studio finish: 6px corners, fine edge highlights, compact controls, and denser typography.', shape: '6px corners', depth: 'Crisp edge + drop', motion: '120ms · 1px lift' },
  { id: 'D', name: 'Suspended', character: 'Light & floating', description: 'Gently floating glass surfaces, a detached player, translucent controls, and a restrained 220ms glide.', shape: '14px corners', depth: 'Floating glass', motion: '220ms · 3px lift' },
  { id: 'E', name: 'Studio', character: 'Calm & tactile', description: 'Quiet typography, rounded navigation and circular transport controls. A sliding tab pill adds gentle, tactile feedback.', shape: '14px buttons · 22px artwork', depth: 'Raised + recessed', motion: '200ms · sliding tabs' },
] as const;

export type DirectionId = typeof directions[number]['id'];
export const parseDirection = (value: string | null): DirectionId => directions.find(direction => direction.id === value?.toUpperCase())?.id ?? 'A';

// Local fixtures keep every direction comparable and work without a music server.
function cover(background: string, foreground: string, kind: number) {
  const texture = '<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".16"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>';
  const forms = [
    '<circle cx="345" cy="205" r="142" fill="url(#light)"/><path d="M-30 490 190 255 380 490 530 330 750 615H-30Z" fill="#1c2425"/><path d="m-40 540 260-160 210 155 135-80 170 155H-40Z" fill="#101818"/>',
    '<path d="M-30 425Q180 0 300 270T730 150V740H-30Z" fill="url(#light)"/><path d="M-30 580Q220 155 330 400T730 300" fill="none" stroke="currentColor" stroke-width="3"/>',
    Array.from({ length: 14 }, (_, i) => `<path d="M${i * 48 - 60} 720 300 ${i * 36 - 80} 770 ${i * 48}" fill="none" stroke="currentColor" stroke-width="${i % 3 ? 2 : 8}" opacity="${.15 + i * .045}"/>`).join(''),
    '<circle cx="360" cy="300" r="180" fill="url(#light)"/><path d="m0 640 190-350 110 195 105-120 315 350H0Z" fill="#1b182b"/><path d="m250 720 110-370 110 370" fill="none" stroke="currentColor" stroke-width="3"/>',
    '<path d="M120 80v520m80-540v540m80-500v520m80-470v450m80-490v520m80-510v490m80-510v520" stroke="currentColor" stroke-width="25" opacity=".45"/><circle cx="470" cy="450" r="160" fill="url(#light)" opacity=".8"/>',
  ];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720" style="color:${foreground}"><defs><linearGradient id="light" x2=".7" y2="1"><stop stop-color="${foreground}"/><stop offset="1" stop-color="${background}"/></linearGradient>${texture}</defs><rect width="720" height="720" fill="${background}"/><g filter="url(#grain)">${forms[kind]}</g><path d="M45 45h28m-28 0v28M675 45h-28m28 0v28M45 675h28m-28 0v-28M675 675h-28m28 0v-28" fill="none" stroke="${foreground}" opacity=".45"/></svg>`)}`;
}

export const songs = [
  { id: 'binary', title: 'Sorting Array', artist: 'The Algorithms', album: 'Binary Sunset', seconds: 420, art: cover('#746546', '#efcfa0', 0) },
  { id: 'study', title: 'Coffee Shop Noise', artist: 'Lo-Fi Dreams', album: 'Study Beats', seconds: 180, art: cover('#583e3b', '#dbae9d', 1) },
  { id: 'digital', title: 'Glitch in the Matrix', artist: 'Cyber Punkers', album: 'Digital Rain', seconds: 305, art: cover('#1a4240', '#83b6a0', 2) },
  { id: 'midnight', title: 'Neon Highway', artist: 'Neon Void', album: 'Midnight City', seconds: 245, art: cover('#393249', '#ba9aab', 3) },
  { id: 'window', title: 'Rainy Window', artist: 'Lo-Fi Dreams', album: 'Quiet Weather', seconds: 150, art: cover('#344653', '#92abb3', 4) },
];
export type PreviewSong = typeof songs[number];
export const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
