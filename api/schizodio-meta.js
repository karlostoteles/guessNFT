/**
 * Vercel serverless function — SCHIZODIO metadata proxy.
 *
 * Same as the Netlify version but using Vercel's API route format.
 * Usage: /api/schizodio-meta?id=292
 */
export default async function handler(req, res) {
  const id = req.query.id;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  try {
    const resp = await fetch(`https://schizodio.art/nft/${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhoisWhoGame/1.0)' },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ error: `schizodio.art returned ${resp.status}` });
    }

    const html = await resp.text();

    const imageMatch = html.match(/\/static\/images_webp_512\/([0-9a-f]{64}\.webp)/);
    const imageUrl = imageMatch
      ? `https://schizodio.art/static/images_webp_512/${imageMatch[1]}`
      : null;

    const nameMatch = html.match(/<title>([^<]+?)(?:\s*[•\-|]|\s*<)/);
    const name = nameMatch ? nameMatch[1].trim() : `SCHIZODIO #${id}`;

    if (!imageUrl) {
      return res.status(404).json({ error: 'Image not found in page', name });
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    return res.json({ imageUrl, name, tokenId: id });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
