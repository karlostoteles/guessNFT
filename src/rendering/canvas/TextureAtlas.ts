/**
 * TextureAtlas — packs many small portraits into one large canvas texture.
 *
 * Used by MinimalGrid to render 999+ character tiles in a single draw call
 * while still showing actual artwork (procedural portraits + NFT images).
 *
 * Layout: a square grid of cells on one canvas.  Each cell holds one portrait.
 * A per-instance UV attribute tells the shader which cell to sample.
 *
 * Progressive updates: call `drawCell(index, source)` to update any cell
 * in-place.  The underlying CanvasTexture is marked `needsUpdate` automatically
 * so Three.js re-uploads to GPU on the next frame.
 */

import * as THREE from 'three';

export class TextureAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: THREE.CanvasTexture;
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly capacity: number;

  constructor(totalCells: number, cellSize = 128) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(Math.sqrt(totalCells));
    this.rows = Math.ceil(totalCells / this.cols);
    this.capacity = this.cols * this.rows;

    const w = this.cols * cellSize;
    const h = this.rows * cellSize;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;

    // Fill with dark background so empty cells aren't white
    this.ctx.fillStyle = '#0f0e17';
    this.ctx.fillRect(0, 0, w, h);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false; // avoid inter-cell bleeding
    this.texture.needsUpdate = true;
  }

  /** Draw an image source into the atlas cell at `index`. */
  drawCell(index: number, source: HTMLCanvasElement | HTMLImageElement): void {
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);
    const x = col * this.cellSize;
    const y = row * this.cellSize;

    this.ctx.clearRect(x, y, this.cellSize, this.cellSize);
    this.ctx.drawImage(source, x, y, this.cellSize, this.cellSize);
    this.texture.needsUpdate = true;
  }

  /** Fill a cell with a solid colour (fast initial fallback). */
  fillCell(index: number, color: string): void {
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);
    const x = col * this.cellSize;
    const y = row * this.cellSize;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
    this.texture.needsUpdate = true;
  }

  /**
   * Get the UV offset and scale for a given cell index.
   *
   * Returns [uOffset, vOffset, uScale, vScale] in WebGL UV space
   * (origin bottom-left, +U right, +V up).
   *
   * Canvas space has origin top-left (+y down), so we flip V:
   *   canvas row 0 → top of canvas → V near 1.0
   *   last row      → bottom       → V near 0.0
   */
  getUV(index: number): [number, number, number, number] {
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);
    const uScale = 1 / this.cols;
    const vScale = 1 / this.rows;
    const uOffset = col * uScale;
    const vOffset = 1 - (row + 1) * vScale; // flip Y
    return [uOffset, vOffset, uScale, vScale];
  }

  /**
   * Draw a pre-built atlas image over the entire canvas in one operation.
   * Use this when a server-side baked WebP is available — faster than per-cell updates.
   */
  drawFull(source: HTMLImageElement | HTMLCanvasElement): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }

  /** Mark the texture as needing a GPU upload (call after batch updates). */
  markDirty(): void {
    this.texture.needsUpdate = true;
  }

  /** Release GPU resources and CPU canvas memory. */
  dispose(): void {
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
