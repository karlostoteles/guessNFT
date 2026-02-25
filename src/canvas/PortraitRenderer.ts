import * as THREE from 'three';
import { Character } from '../data/characters';
import { drawFace } from './drawFace';
import { drawHair } from './drawHair';
import { drawAccessories } from './drawAccessories';

const SIZE = 512;
const BG_COLORS = [
  '#E8D5B7', '#D5C4A1', '#C9B8A0', '#BFAE96',
  '#D6C5B0', '#E0D0BC', '#CCBDA8', '#D3C2AD',
];

export function renderPortrait(character: Character): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Background
  const bgIdx = Math.abs(hashCode(character.id)) % BG_COLORS.length;
  const bg = BG_COLORS[bgIdx];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle radial gradient overlay
  const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 50, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Draw in order: hair back, face, hair front, accessories
  const traits = character.traits;

  // Hair drawn first (behind face for long/curly styles)
  if (traits.hair_style === 'long' || traits.hair_style === 'curly') {
    drawHair(ctx, traits);
    drawFace(ctx, traits);
  } else {
    drawFace(ctx, traits);
    drawHair(ctx, traits);
  }

  drawAccessories(ctx, traits);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function renderCardBack(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Dark gradient
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < SIZE; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(SIZE, i);
    ctx.stroke();
  }

  // Question mark
  ctx.font = 'bold 200px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(232, 164, 68, 0.6)';
  ctx.fillText('?', SIZE / 2, SIZE / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
