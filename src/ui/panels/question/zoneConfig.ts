/**
 * Trait-based categories for NFT questions.
 * Each category maps to a traitKey prefix in the question data.
 * This replaces the old body-part zone system (HAIR/FACE/BODY/GEAR).
 */

export type TraitCategory = 'hair' | 'eyes' | 'mouth' | 'brows' | 'body' | 'clothing' | 'gear' | 'background';

export const TRAIT_CONFIG: Record<TraitCategory, {
  label: string;
  icon: string;
  color: string;
  /** Which traitKey prefix(es) map to this category */
  traitKeys: string[];
}> = {
  hair: { label: 'Hair', icon: '💇', color: '#E8A444', traitKeys: ['nft_hair'] },
  eyes: { label: 'Eyes', icon: '👁️', color: '#60CDFF', traitKeys: ['nft_eyes', 'nft_has_mask'] },
  brows: { label: 'Brows', icon: '🤨', color: '#FACC15', traitKeys: ['nft_eyebrows'] },
  mouth: { label: 'Mouth', icon: '👄', color: '#F472B6', traitKeys: ['nft_mouth'] },
  body: { label: 'Body', icon: '🧬', color: '#A855F7', traitKeys: ['nft_body'] },
  clothing: { label: 'Clothing', icon: '👕', color: '#22D3EE', traitKeys: ['nft_clothing'] },
  gear: { label: 'Gear', icon: '⚔️', color: '#EF4444', traitKeys: ['nft_has_weapons', 'nft_has_eyewear', 'nft_has_headwear', 'nft_has_accessories', 'nft_has_overlay', 'nft_has_sidekick', 'nft_sidekick'] },
  background: { label: 'Scene', icon: '🏖️', color: '#4ADE80', traitKeys: ['nft_background'] },
};

export const TRAIT_CATEGORIES: TraitCategory[] = ['hair', 'eyes', 'brows', 'mouth', 'body', 'clothing', 'gear', 'background'];

/** Given a question's traitKey, find which category it belongs to */
export function getTraitCategory(traitKey: string): TraitCategory | null {
  for (const [cat, cfg] of Object.entries(TRAIT_CONFIG)) {
    if (cfg.traitKeys.some(tk => traitKey === tk || traitKey.startsWith(tk))) {
      return cat as TraitCategory;
    }
  }
  return null;
}
