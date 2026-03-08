# Design System: GuessNFT
**Project ID:** guess-nft-local

## 1. Visual Theme & Atmosphere
The application embodies a **"Neon Arcane"** aesthetic. It is deeply atmospheric, using vast, shadowy backgrounds (`#0f0e17`) lit by soft, glowing gradients and bright, saturated neon accents. The mood feels both magical and highly competitive, blending Web3 crypto-native playfulness (like meme coins and NFTs) with a premium, polished, Pixar-style physical board game feel. Micro-animations, floating particles, and layered depth give the interface a tangible, dynamic, and responsive quality.

## 2. Color Palette & Roles
* **Deep Space Void** (`#0f0e17`): The primary background color. Provides an infinite, dark canvas that makes neon elements pop.
* **Crisp Paper White** (`#FFFFFE`): Used for primary text, ensuring maximum high-contrast readability against the dark void.
* **Vibrant Golden Orange** (`#E8A444`): The primary "Legendary" action color. Used for the main branding, the "Play for Real" (1v1) tile, and confirming top-tier interactions.
* **Electric Amethyst** (`#7C3AED` to `#5B21B6`): The primary "Free to Play" and AI interaction color. Used for the AI Practice tile, providing a magical, algorithmic vibe.
* **Soft Lilac** (`#A78BFA`): A lighter secondary purple for tags, badges, and subtle highlights within the Amethyst theme.
* **Playful Pink** (`#F472B6`): Secondary accent color, often mixed into gradients alongside Orange and Purple to create a warm, synthwave-like bridge between the two primary opposing colors.
* **Translucent Glass** (`rgba(255,255,255,0.06)`): Used as a base for cards and buttons to create frosted, glassmorphic separation over the background without introducing solid gray blocks.

## 3. Typography Rules
* **Headers & Display Text:** Uses `'Space Grotesk', sans-serif`. It is heavily weighted (700-800) for a bold, futuristic, and slightly quirky geometry. Often enhanced with negative letter-spacing (`-0.01em` or `-0.02em`) to bind words tightly together.
* **Body & UI Defaults:** Uses `'Inter', sans-serif`. Clean, legible, and neutral, allowing the Display text to take all the attention.

## 4. Component Stylings
* **Primary Play Tiles:** Generously rounded corners (`16px`), deeply saturated gradients, and dramatic, glowing box shadows upon hover (`0 0 56px rgba(232,164,68,0.35)`). They contain immersive background images mixed with a dark vertical gradient fade for text legibility.
* **Option Cards / Badges:** Subtly rounded corners (`14px` for cards, `8px` for badges). They rely on colored, translucent backgrounds (e.g., `rgba(124,58,237,0.15)`) and delicate borders to group information without feeling heavy.
* **Buttons:** Varying from pill-shaped (`border-radius: 20px` for tabs/badges) to softly rectangular (`border-radius: 8px`). They feature spring-based hover micro-animations (e.g., `scale: 1.05`) to feel physically tactile.

## 5. Layout Principles
* **Whitespace & Centering:** Employs a theatrical staging approach. Content is often horizontally and vertically centered with substantial negative space around the edges, drawing the eye to the glowing interactive elements.
* **Stacking & Depth:** Relies heavily on Z-index layers and backdrop blurs (`backdrop-filter: blur(24px)`). Floating panels rest physically above the main game board or void background, simulating a physical table presence.
