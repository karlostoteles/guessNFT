/**
 * Netlify serverless function — SCHIZODIO metadata proxy.
 *
 * The on-chain tokenURI points to techshaman.42024769.xyz which is currently
 * down (Traefik self-signed cert + backend offline). This function fetches
 * the NFT detail page from schizodio.art (server-side, no CORS) and extracts
 * the image URL + name.
 *
 * Usage: /.netlify/functions/schizodio-meta?id=292
 */
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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhoisWhoGame/1.0)' },
    });

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders(),
        body: JSON.stringify({ error: `schizodio.art returned ${resp.status}` }),
      };
    }

    const html = await resp.text();

    // Extract full-resolution image path: /static/images_webp_512/{sha256}.webp
    const imageMatch = html.match(/\/static\/images_webp_512\/([0-9a-f]{64}\.webp)/);
    const imageUrl = imageMatch
      ? `https://schizodio.art/static/images_webp_512/${imageMatch[1]}`
      : null;

    // Extract name from <title>Schizodio #292 • ...</title>
    const nameMatch = html.match(/<title>([^<]+?)(?:\s*[•\-|]|\s*<)/);
    const name = nameMatch ? nameMatch[1].trim() : `SCHIZODIO #${id}`;

    if (!imageUrl) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Image not found in page', name }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
      body: JSON.stringify({ imageUrl, name, tokenId: id }),
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
