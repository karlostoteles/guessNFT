/**
 * ImageCache - Unified image loading and caching service
 *
 * SOLVES: Duplicate image loading between Three.js and React UI
 */

import * as THREE from 'three';
import { resolveUrl } from '@/services/starknet/nftService';

// ─── Types ────────────────────────────────────────────────────────────────

interface CachedImage {
  /** The loaded image element (source) */
  image: HTMLImageElement | HTMLCanvasElement;
  /** Pre-computed THREE.Texture (lazy-created on demand) */
  texture: THREE.Texture | null;
  /** Data URL for React <img> (lazy-created on demand) */
  dataUrl: string | null;
  /** Original URL used to load this image */
  sourceUrl: string;
  /** Timestamp when loaded */
  loadedAt: number;
}

interface LoadOptions {
  /** Size to resize image to (default: 128) */
  size?: number;
  /** Force reload even if cached */
  force?: boolean;
}

// ─── Global Cache & Deduplication ─────────────────────────────────────────

const imageCache = new Map<string, CachedImage>();
const pendingLoads = new Map<string, Promise<HTMLImageElement | HTMLCanvasElement | null>>();
const proceduralCache = new Map<string, HTMLCanvasElement>();

const DEFAULT_SIZE = 128;
const MAX_CACHE_SIZE = 1500;

// ─── Helper Functions ─────────────────────────────────────────────────────

function extractImageHash(url: string): string | null {
  const match = url.match(/\/([a-f0-9]+)\.png$/i);
  return match ? match[1] : null;
}

function getLoadUrls(charId: string, imageUrl?: string): string[] {
  const numericId = charId.replace('nft_', '');
  const hash = imageUrl ? extractImageHash(imageUrl) : null;

  return [
    hash ? `https://v1assets.schizod.io/images/revealed/${hash}.png` : null,
    `/nft/${numericId}.png`,
    imageUrl ? resolveUrl(imageUrl) : null,
  ].filter(Boolean) as string[];
}

function loadImage(url: string, timeout = 10000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(null);
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

function resizeImage(source: HTMLImageElement | HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, size, size);
  return canvas;
}

function evictIfNeeded(): void {
  if (imageCache.size <= MAX_CACHE_SIZE) return;
  const entries = Array.from(imageCache.entries());
  entries.sort((a, b) => a[1].loadedAt - b[1].loadedAt);
  const toEvict = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  for (const [id, cached] of toEvict) {
    if (cached.texture) cached.texture.dispose();
    imageCache.delete(id);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export const ImageCache = {
  async load(
    charId: string,
    imageUrl?: string,
    options: LoadOptions = {}
  ): Promise<HTMLImageElement | HTMLCanvasElement | null> {
    const { size = DEFAULT_SIZE, force = false } = options;

    if (!force && imageCache.has(charId)) {
      const cached = imageCache.get(charId)!;
      // If it's just a procedural placeholder and we have an imageUrl, try loading the real one
      if (cached.sourceUrl !== 'procedural' || !imageUrl) {
        return cached.image;
      }
    }

    if (pendingLoads.has(charId)) {
      return pendingLoads.get(charId)!;
    }

    const loadPromise = (async (): Promise<HTMLImageElement | HTMLCanvasElement | null> => {
      const urls = getLoadUrls(charId, imageUrl);

      for (const url of urls) {
        try {
          const img = await loadImage(url);
          if (img) {
            const resized = resizeImage(img, size);
            imageCache.set(charId, {
              image: resized,
              texture: null,
              dataUrl: null,
              sourceUrl: url,
              loadedAt: Date.now(),
            });
            evictIfNeeded();
            return resized;
          }
        } catch (err) {
          console.warn(`[ImageCache] Failed: #${charId} from ${url}`);
        }
      }
      return null;
    })();

    pendingLoads.set(charId, loadPromise);
    const result = await loadPromise;
    pendingLoads.delete(charId);
    return result;
  },

  get(charId: string): HTMLImageElement | HTMLCanvasElement | null {
    return imageCache.get(charId)?.image ?? null;
  },

  getTexture(charId: string): THREE.Texture | null {
    const cached = imageCache.get(charId);
    if (!cached) return null;

    if (!cached.texture) {
      const texture = new THREE.CanvasTexture(
        cached.image instanceof HTMLCanvasElement
          ? cached.image
          : resizeImage(cached.image, DEFAULT_SIZE)
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      cached.texture = texture;
    }
    return cached.texture;
  },

  getUrl(charId: string): string | null {
    const cached = imageCache.get(charId);
    if (!cached) return null;

    if (!cached.dataUrl) {
      if (cached.image instanceof HTMLCanvasElement) {
        cached.dataUrl = (cached.image as HTMLCanvasElement).toDataURL();
      } else {
        const canvas = resizeImage(cached.image, DEFAULT_SIZE);
        cached.dataUrl = canvas.toDataURL();
      }
    }
    return cached.dataUrl;
  },

  getSourceUrl(charId: string): string | null {
    const cached = imageCache.get(charId);
    return cached?.sourceUrl !== 'procedural' ? cached?.sourceUrl ?? null : null;
  },

  has(charId: string): boolean {
    const cached = imageCache.get(charId);
    return !!cached && cached.sourceUrl !== 'procedural';
  },

  isLoading(charId: string): boolean {
    return pendingLoads.has(charId);
  },

  setProcedural(charId: string, canvas: HTMLCanvasElement): void {
    proceduralCache.set(charId, canvas);
    if (!imageCache.has(charId)) {
      imageCache.set(charId, {
        image: canvas,
        texture: null,
        dataUrl: null,
        sourceUrl: 'procedural',
        loadedAt: Date.now(),
      });
    }
  },

  getProcedural(charId: string): HTMLCanvasElement | null {
    return proceduralCache.get(charId) ?? null;
  },

  async batchLoad(
    characters: Array<{ id: string; imageUrl?: string }>,
    options: LoadOptions & { batchSize?: number; batchDelay?: number } = {}
  ): Promise<void> {
    const { batchSize = 20, batchDelay = 50, ...loadOptions } = options;

    for (let i = 0; i < characters.length; i += batchSize) {
      const batch = characters.slice(i, i + batchSize);
      await Promise.all(
        batch.map(char => this.load(char.id, char.imageUrl, loadOptions))
      );
      if (i + batchSize < characters.length && batchDelay > 0) {
        await new Promise(r => setTimeout(r, batchDelay));
      }
    }
  },

  async preloadVisible(
    characters: Array<{ id: string; imageUrl?: string }>,
    visibleIndices: number[],
    options: LoadOptions = {}
  ): Promise<void> {
    const visibleChars = visibleIndices
      .filter(i => i >= 0 && i < characters.length)
      .map(i => characters[i]);
    await this.batchLoad(visibleChars, { ...options, batchDelay: 0 });
  },

  clearProcedural(): void {
    proceduralCache.clear();
  },

  clear(): void {
    for (const cached of imageCache.values()) {
      if (cached.texture) cached.texture.dispose();
    }
    imageCache.clear();
    proceduralCache.clear();
    pendingLoads.clear();
  },

  getStats() {
    return {
      cached: imageCache.size,
      pending: pendingLoads.size,
      procedural: proceduralCache.size,
    };
  },

  _textureCache: imageCache,
  _proceduralCache: proceduralCache,
};

export const globalTextureCache = {
  get(charId: string) { return ImageCache.getTexture(charId) ?? undefined; },
  set(charId: string, texture: THREE.Texture) {
    const cached = imageCache.get(charId);
    if (cached) cached.texture = texture;
  },
  has(charId: string) { return ImageCache.has(charId); },
};

export const proceduralCanvasCache = {
  get(charId: string) { return proceduralCache.get(charId) ?? undefined; },
  set(charId: string, canvas: HTMLCanvasElement) { ImageCache.setProcedural(charId, canvas); },
  has(charId: string) { return proceduralCache.has(charId); },
};

export default ImageCache;
