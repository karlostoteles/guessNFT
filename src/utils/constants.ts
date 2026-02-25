export const BOARD = {
  width: 14,
  depth: 10,
  height: 0.3,
  tiltAngle: 0.21, // ~12 degrees in radians
  color: '#2d1810',
} as const;

export const TILE = {
  width: 1.4,
  height: 1.8,
  depth: 0.06,
  gap: 0.35,
  cols: 6,
  rows: 4,
} as const;

export const CAMERA = {
  player1: { position: [0, 7, 11] as const, lookAt: [0, 1.5, 0] as const },
  player2: { position: [0, 7, 11] as const, lookAt: [0, 1.5, 0] as const },
  overview: { position: [0, 12, 14] as const, lookAt: [0, 1, 0] as const },
} as const;

export const COLORS = {
  player1: { primary: '#E8A444', bg: 'rgba(232, 164, 68, 0.15)' },
  player2: { primary: '#44A8E8', bg: 'rgba(68, 168, 232, 0.15)' },
  background: '#0f0e17',
  surface: 'rgba(255, 255, 255, 0.08)',
  surfaceHover: 'rgba(255, 255, 255, 0.14)',
  text: '#FFFFFE',
  textMuted: 'rgba(255, 255, 254, 0.6)',
  accent: '#E8A444',
  yes: '#4CAF50',
  no: '#E05555',
} as const;
