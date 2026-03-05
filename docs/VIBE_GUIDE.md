# guessNFT — Vibe-Coder Guide

> **This file is for you** — the human writing prompts to build features. Copy-paste the recipes, adapt the examples, and follow the rules at the bottom to keep the game fast and clean.
>
> AI agents: this file is also for you. Follow every recipe and checklist here exactly.

---

## What Is This Game?

guessNFT is a browser-based **1v1 deduction game** — "Guess Who?" for NFT collections. Each player secretly picks a character from a shared board of NFT portraits. On your turn, you ask a yes/no question about a trait ("Does your character wear a hat?"). The answer lets you eliminate characters who don't match. First to correctly guess the opponent's character wins.

The board is a **live 3D grid** that shrinks as characters get eliminated. It works with real Starknet NFTs — each NFT's metadata (traits, accessories, colors) drives what questions are available.

---

## The Design Palette

Use these exact values when asking for visual changes. Never invent new colors.

### Colors

| Name | Hex | When to use |
|---|---|---|
| **Gold** | `#E8A444` | Primary actions, Player 1 accent, highlights |
| **Blue** | `#44A8E8` | Player 2 accent |
| **Background** | `#0f0e17` | Page background, dark fills |
| **Surface** | `rgba(255,255,255,0.08)` | Card inner sections, subtle containers |
| **Surface hover** | `rgba(255,255,255,0.14)` | Hover state |
| **Text** | `#FFFFFE` | All primary text |
| **Text muted** | `rgba(255,255,254,0.6)` | Labels, secondary info |
| **Yes / correct** | `#4CAF50` | YES answers, success states |
| **No / wrong** | `#E05555` | NO answers, error states |

### Fonts

- **Everything:** `Space Grotesk` — weight 600 for titles/buttons, 400–500 for body text

### Buttons (ready-made variants)

The `Button` component already exists. Just pick a variant:

| Variant | Look | Use for |
|---|---|---|
| `accent` | Gold gradient | Main CTA ("Ask", "Guess", "Play") |
| `primary` | White glass | Secondary actions |
| `secondary` | Dimmer glass | Cancel, back, dismiss |
| `yes` | Green gradient | YES answer buttons |
| `no` | Red gradient | NO answer buttons |

---

## What You Can Build

### Visual / UI

| What | Prompt keyword | Where it goes |
|---|---|---|
| New full-page screen | "new screen" | `src/ui/screens/` |
| New gameplay panel | "new panel" | `src/ui/panels/` |
| New popup/overlay | "new overlay" | `src/ui/overlays/` |
| New HUD element | "new widget" | `src/ui/widgets/` |
| Style change | "change the colors/layout/spacing" | Existing component file |
| Animation change | "make it animate / smoother / faster" | Existing component + Framer Motion |

### Game Mechanics

| What | Prompt keyword | Files touched |
|---|---|---|
| New yes/no question | "add a question" | `core/data/questions.ts` |
| New character trait | "add a trait" | `traits.ts` → `characters.ts` → `questions.ts` → `evaluateQuestion.ts` → `canvas/draw*.ts` |
| CPU behavior change | "make CPU smarter / riskier / faster" | `core/ai/cpuAgent.ts` |
| New game phase | "new game phase" | `store/types.ts` → `store/gameStore.ts` → `UIOverlay.tsx` |

### NFT / Collection

| What | Prompt keyword | Files touched |
|---|---|---|
| Map a new NFT trait name | "add NFT trait mapping" | `core/data/nftCharacterAdapter.ts` |
| Support a new NFT collection | "add collection support" | `nftCharacterAdapter.ts` + `starknet/collectionService.ts` |
| Add an NFT-specific question | "add question for NFT trait" | `core/data/questions.ts` + `core/data/traits.ts` |

### Not Ready Yet (Phase 2)

Don't ask for these yet — the contracts don't exist:
- On-chain answer verification
- Anti-cheat commit-reveal (on-chain)
- Real-money stakes or ranking

---

## Prompt Recipes

Copy these, change the values in `[ ]`, and send.

---

### Add a new yes/no question

```
Add a new question to the game:
- Question text: "Does your character have [sunglasses]?"
- Trait it tests: has_[sunglasses] (boolean, true/false)
- Category: accessories

Follow the existing pattern in src/core/data/questions.ts.
Also update src/core/data/traits.ts to add has_[sunglasses]: boolean.
Also update src/core/data/characters.ts to add the trait to each character.
Also update src/core/rules/evaluateQuestion.ts if needed.
Run npm run build to verify. Don't change anything else.
```

---

### Add a new NFT trait mapping

```
The [COLLECTION_NAME] NFT collection has a trait called "[Background Color]"
with values like "red", "blue", "gold", "none".

Map this trait to the game system:
1. Add background_color to CharacterTraits in src/core/data/traits.ts
2. Add a findAttribute() call for it in src/core/data/nftCharacterAdapter.ts
   using these trait_type names: ["Background Color", "Background", "BG"]
3. Add questions for it in src/core/data/questions.ts
4. Update src/core/rules/evaluateQuestion.ts

Run npm run build to verify. Don't touch anything else.
```

---

### Create a new UI panel

```
Create a new gameplay panel called [ScorePanel]:
- It appears during the [QUESTION_SELECT] phase
- It shows [the current turn number and how many characters each player has eliminated]
- Use the Card component from src/ui/common/Card.tsx
- Use the existing color tokens (gold #E8A444 for player 1, blue #44A8E8 for player 2)
- Position it at the top-left of the screen
- Read state using selectors from src/core/store/selectors.ts — don't access the store directly

Steps:
1. Create src/ui/panels/ScorePanel.tsx
2. Export it from src/ui/panels/index.ts
3. Import and render it in src/ui/UIOverlay.tsx during the right phase
4. Run npm run build to verify
```

---

### Polish an existing screen

```
Polish the [QuestionPanel] in src/ui/panels/QuestionPanel.tsx:
- Make the layout tighter — reduce padding to 16px
- Make the question text larger (18px, font-weight 600)
- Add a subtle entrance animation: slide up from y+20, fade in over 300ms
- Use the existing Framer Motion spring (stiffness: 300, damping: 30)
- Keep all existing colors exactly as they are
- Don't add new dependencies or components
- Run npm run build to verify
```

---

### Make the board faster

```
Optimize the character grid rendering:
- In src/rendering/scene/CharacterGrid.tsx, convert eliminatedIds array to Set before any filter or includes() call
- In src/shared/hooks/useCharacterTextures.ts, make sure old textures are disposed when tileW changes
- Don't change any visual behavior, only performance
- Run npm run build to verify
```

---

### Support a new NFT collection

```
Add support for the [NAME] NFT collection on Starknet:
- Contract address: [0x...]
- Trait names in their metadata: [list them here]
- Add the contract to src/services/starknet/config.ts
- Add attribute name mappings in src/core/data/nftCharacterAdapter.ts
  using findAttribute() for each trait
- Add a collection entry in src/services/starknet/collectionService.ts

Use the existing SCHIZODIO integration as a reference.
Run npm run build to verify. Don't change game logic.
```

---

## NFT Trait Connection — How It Works

> Read this before asking to add any NFT-related feature.

Each NFT has **metadata attributes** — things like `{ trait_type: "Eyes", value: "Blue" }`. This game turns those into **yes/no questions** on the board.

Here's the chain:

```
NFT metadata
  → nftCharacterAdapter.ts maps "Eyes: Blue" to eye_color: 'blue'
  → traits.ts defines EyeColor = 'brown' | 'blue' | 'green' | 'hazel'
  → questions.ts has { traitKey: 'eye_color', traitValue: 'blue', text: "Does your character have blue eyes?" }
  → evaluateQuestion.ts checks char.traits['eye_color'] === 'blue'
  → game eliminates characters who don't match the answer
```

**What makes a good NFT question:**
- Splits the board as close to 50/50 as possible (half characters have it, half don't)
- Has clear visual meaning — players can look at a portrait and guess the answer
- Maps to something the NFT collection actually tracks in metadata

**What makes a bad NFT question:**
- A trait that only 1 or 2 characters have (eliminates almost nothing)
- A trait that 23 out of 24 characters have (eliminates almost everything in one shot)
- A trait that can't be determined by looking at the portrait

**Known SCHIZODIO attribute names:**

| Their name | Maps to game trait |
|---|---|
| `Eyes`, `Eye Color` | `eye_color` |
| `Hair Color`, `Hair` | `hair_color` |
| `Hair Style`, `Hairstyle` | `hair_style` |
| `Body`, `Skin`, `Skin Tone` | `skin_tone` |
| `Glasses`, `Eyewear` | `has_glasses` |
| `Hat`, `Headwear`, `Head` | `has_hat` |
| `Beard`, `Facial Hair` | `has_beard` |
| `Earrings`, `Ear` | `has_earrings` |
| `Gender`, `Sex`, `Type` | `gender` |

---

## How to Scope Your Request

**One prompt = one thing.** This keeps the agent focused and prevents it from touching code it shouldn't.

### Bad prompt (too big)
> "Make the game look better, add new questions, and support the new NFT collection"

This will touch 15+ files, probably break something, and be hard to review.

### Good prompts (scoped)
> "Polish the QuestionPanel — make the layout tighter and add a slide-up animation"

> "Add a yes/no question: Does your character have a nose ring?"

> "Add NFT trait mapping for the Background attribute in SCHIZODIO"

### How to split a big feature

If you have a big idea, break it into steps and send them one at a time:

1. "Add `has_nose_ring` to traits.ts and update all characters in characters.ts"
2. "Add a question for has_nose_ring in questions.ts and update evaluateQuestion.ts"
3. "Add the nose ring drawing to drawAccessories.ts in rendering/canvas/"

---

## What to Always Include in Your Prompt

Paste this checklist at the end of any prompt:

```
Rules for the agent:
- Follow the existing patterns in the files you touch
- Use Card and Button from src/ui/common/ for any new UI
- Use @/ imports for cross-module paths, ./ for same-folder imports
- Run npm run build before finishing — zero TypeScript errors required
- Don't change anything outside the scope of this task
- Don't clean up or reformat code you're not changing
```

---

## What NOT to Ask in One Prompt

These will cause problems if you ask all at once:

- Adding a trait + rendering it in 3D + adding questions + UI changes → too many files
- "Refactor the store" → never ask for this without a very specific goal
- "Make everything faster" → too vague, ask for one specific optimization
- "Clean up the code" → the agent will remove things it thinks are unused, which breaks features
- "Add on-chain verification" → Phase 2, contracts don't exist yet

---

## Quick Reference — Where Things Live

| What you want to change | File |
|---|---|
| Questions players can ask | `src/core/data/questions.ts` |
| Character trait definitions | `src/core/data/traits.ts` |
| Character data (24 characters) | `src/core/data/characters.ts` |
| How questions eliminate characters | `src/core/rules/evaluateQuestion.ts` |
| NFT → game trait mapping | `src/core/data/nftCharacterAdapter.ts` |
| Game flow / phases | `src/core/store/gameStore.ts` + `src/core/store/types.ts` |
| CPU opponent strategy | `src/core/ai/cpuAgent.ts` |
| 3D board rendering | `src/rendering/scene/` |
| Character portrait drawing | `src/rendering/canvas/draw*.ts` |
| What appears on screen per phase | `src/ui/UIOverlay.tsx` |
| Wallet / NFT fetching | `src/services/starknet/` |
| Online multiplayer | `src/services/supabase/` + `src/shared/hooks/useOnlineGameSync.ts` |
| Sound effects | `src/shared/audio/sfx.ts` |
| Colors / constants | `src/core/rules/constants.ts` |
