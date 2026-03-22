/**
 * Netlify serverless function — SCHIZODIO metadata proxy.
 *
 * Fetches the NFT detail page from schizodio.art (server-side, no CORS)
 * and extracts image URL, name, AND all 14 trait attributes.
 *
 * The on-chain tokenURI points to techshaman.42024769.xyz which is currently
 * down (broken SSL + backend offline). This proxy is the primary data source.
 *
 * Usage: /.netlify/functions/schizodio-meta?id=292
 *
 * Returns: { imageUrl, name, tokenId, attributes: [{ trait_type, value }] }
 */

/** All 14 SCHIZODIO trait categories in the order they appear on schizodio.art */
const TRAIT_NAMES = [
  'Accessories', 'Background', 'Body', 'Clothing', 'Eyebrows',
  'Eyes', 'Eyewear', 'Hair', 'Headwear', 'Mask',
  'Mouth', 'Overlays', 'Sidekick', 'Weapons',
];

/**
 * Parse trait attributes from the schizodio.art NFT detail HTML.
 *
 * Strategy: for each known trait name, find it as text content in the HTML
 * (e.g. `>Hair</span>`) and grab the next non-empty text node as the value.
 * Tolerates up to 500 characters of markup between name and value.
 */
function parseTraits(html) {
  const attributes = [];

  for (const trait of TRAIT_NAMES) {
    // Pattern: >TraitName</tag>...markup...<tag>TraitValue</tag>
    // Captures the first substantial text content after the trait name.
    const escaped = trait.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `>\\s*${escaped}\\s*</` +  // >Accessories</ (closing tag start)
      `[\\s\\S]{0,500}?` +       // up to 500 chars of intervening markup
      `>\\s*([^<]{2,100})\\s*<`,  // >No Accessories< (next text, 2-100 chars)
      'i'
    );
    const match = html.match(regex);
    if (match?.[1]) {
      const value = match[1].trim();
      // Skip if the "value" is just the trait name repeated
      if (value && value.toLowerCase() !== trait.toLowerCase()) {
        attributes.push({ trait_type: trait, value });
      }
    }
  }

  return attributes;
}

export const handler = async (event) => {
  const id = event.queryStringParameters?.id;

  if (!id || !/^\d+$/.test(id)) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Invalid token ID' }),
    };
  }

  try {
    const resp = await fetch(`https://schizodio.art/nft/${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; guessNFT/1.0)' },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders(),
        body: JSON.stringify({ error: `schizodio.art returned ${resp.status}` }),
      };
    }

    const html = await resp.text();

    // Extract full-resolution image hash: /static/images_webp_512/{sha256}.webp
    // Serve from the v1assets.schizod.io CDN (faster, reliable) as .png
    const imageMatch = html.match(/\/static\/images_webp_512\/([0-9a-f]{64})\.webp/);
    const imageUrl = imageMatch
      ? `https://v1assets.schizod.io/images/revealed/${imageMatch[1]}.png`
      : null;

    // Extract name from <title>Schizodio #292 • ...</title>
    const nameMatch = html.match(/<title>([^<]+?)(?:\s*[•\-|]|\s*<)/);
    const name = nameMatch ? nameMatch[1].trim() : `SCHIZODIO #${id}`;

    // Extract trait attributes from the page HTML
    const attributes = parseTraits(html);

    if (!imageUrl) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Image not found in page', name, attributes }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
      body: JSON.stringify({ imageUrl, name, tokenId: id, attributes }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: String(err) }),
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}
