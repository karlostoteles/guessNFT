/**
 * Maps SCHIZODIO NFTs to the game's Character interface.
 *
 * Strategy: deterministic trait derivation from tokenId hash.
 * If NFT metadata has matching trait_types → map directly.
 * Otherwise → hash tokenId to deterministically assign traits.
 * Same NFT always produces same traits → consistent gameplay.
 */
import type { Character } from './characters';
import type { CharacterTraits, HairColor, HairStyle, SkinTone, EyeColor, Gender } from './traits';
import type { SchizodioNFT, NFTAttribute } from '../starknet/types';

// Game character with source tracking
export interface NFTCharacter extends Character {
  source: 'nft';
  imageUrl: string;
  tokenId: string;
}

export interface MockCharacter extends Character {
  source: 'mock';
}

export type GameCharacter = NFTCharacter | MockCharacter;

// Trait option arrays for deterministic assignment
const HAIR_COLORS: HairColor[] = ['black', 'brown', 'blonde', 'red', 'white', 'blue'];
const HAIR_STYLES: HairStyle[] = ['short', 'long', 'curly', 'bald', 'mohawk', 'ponytail'];
const SKIN_TONES: SkinTone[] = ['light', 'medium', 'tan', 'dark', 'very_dark'];
const EYE_COLORS: EyeColor[] = ['brown', 'blue', 'green', 'hazel'];
const GENDERS: Gender[] = ['male', 'female'];

/**
 * Simple deterministic hash from a string.
 */
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickFromArray<T>(arr: T[], seed: number, offset: number): T {
  return arr[(seed + offset * 7) % arr.length];
}

function findAttribute(attrs: NFTAttribute[], ...traitTypes: string[]): string | undefined {
  for (const tt of traitTypes) {
    const found = attrs.find(
      (a) => a.trait_type.toLowerCase() === tt.toLowerCase()
    );
    if (found) return found.value;
  }
  return undefined;
}

function mapToEnum<T extends string>(
  attrValue: string | undefined,
  options: T[],
  seed: number,
  offset: number
): T {
  if (!attrValue) return pickFromArray(options, seed, offset);

  const lower = attrValue.toLowerCase();
  const match = options.find((o) => o.toLowerCase() === lower);
  if (match !== undefined) return match;

  return pickFromArray(options, seed, offset);
}

function deriveBool(attrValue: string | undefined, seed: number, offset: number): boolean {
  if (!attrValue) return (seed + offset * 13) % 3 === 0; // ~33% chance
  const lower = attrValue.toLowerCase();
  if (lower === 'none' || lower === 'no' || lower === 'false' || lower === '0') return false;
  return true;
}

/**
 * Convert a SCHIZODIO NFT to a game Character with derived traits.
 */
export function nftToCharacter(nft: SchizodioNFT): NFTCharacter {
  const seed = hashString(nft.tokenId);
  const attrs = nft.attributes;

  const traits: CharacterTraits = {
    hair_color: mapToEnum(findAttribute(attrs, 'Hair Color', 'Hair', 'Head'), HAIR_COLORS, seed, 0),
    hair_style: mapToEnum(findAttribute(attrs, 'Hair Style', 'Hairstyle'), HAIR_STYLES, seed, 1),
    skin_tone: mapToEnum(findAttribute(attrs, 'Skin', 'Skin Tone', 'Body'), SKIN_TONES, seed, 2),
    gender: mapToEnum(findAttribute(attrs, 'Gender', 'Sex'), GENDERS, seed, 3),
    eye_color: mapToEnum(findAttribute(attrs, 'Eye Color', 'Eyes'), EYE_COLORS, seed, 4),
    has_glasses: deriveBool(findAttribute(attrs, 'Glasses', 'Eyewear'), seed, 5),
    has_hat: deriveBool(findAttribute(attrs, 'Hat', 'Head Accessory', 'Headwear'), seed, 6),
    has_beard: deriveBool(findAttribute(attrs, 'Beard', 'Facial Hair'), seed, 7),
    has_earrings: deriveBool(findAttribute(attrs, 'Earrings', 'Ear'), seed, 8),
  };

  return {
    id: `nft_${nft.tokenId}`,
    name: nft.name,
    traits,
    source: 'nft',
    imageUrl: nft.imageUrl,
    tokenId: nft.tokenId,
  };
}

/**
 * Wrap a mock character with source tracking.
 */
export function toMockCharacter(char: Character): MockCharacter {
  return { ...char, source: 'mock' };
}

/**
 * Select 24 game characters from owned NFTs.
 * Pads with mock characters if fewer than 24 NFTs.
 */
export function selectGameCharacters(
  nfts: SchizodioNFT[],
  mockCharacters: Character[]
): GameCharacter[] {
  const nftCharacters = nfts.map(nftToCharacter);

  if (nftCharacters.length >= 24) {
    // Shuffle and take 24
    const shuffled = [...nftCharacters].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 24);
  }

  // Pad with mock characters
  const needed = 24 - nftCharacters.length;
  const padding = mockCharacters.slice(0, needed).map(toMockCharacter);
  return [...nftCharacters, ...padding];
}
