/**
 * Vercel serverless function — Redirects to the actual NFT image.
 * Usage: /api/nft-art?id=292
 * 
 * This allows the frontend to load images by ID even though the actual asset URL is a hash.
 */
export default async function handler(req, res) {
    const id = req.query.id;

    if (!id || !/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid token ID' });
    }

    try {
        const resp = await fetch(`https://v1assets.schizod.io/json/revealed/${id}.json`);
        if (!resp.ok) {
            // Fallback or error
            return res.status(resp.status).end();
        }
        const data = await resp.json();
        const imageUrl = data.image;

        if (!imageUrl) {
            return res.status(404).end();
        }

        // Redirect to the actual image host
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
        return res.redirect(307, imageUrl);
    } catch (err) {
        return res.status(500).end();
    }
}
