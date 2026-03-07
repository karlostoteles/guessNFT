// This acts as a mock/proxy for Vercel KV until production keys are linked.
// It stores a global memory object (for demo) but is designed to immediately swap to @vercel/kv

const memoryDb: Record<string, number> = {};

export default async function handler(req, res) {
    // Simple CORS
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    // GET: Fetch top 50 players by wins
    if (req.method === 'GET') {
        const sorted = Object.entries(memoryDb)
            .map(([address, wins]) => ({ address, wins }))
            .sort((a, b) => b.wins - a.wins)
            .slice(0, 50);

        return res.status(200).json({ entries: sorted });
    }

    // POST: Record a win
    if (req.method === 'POST') {
        const { winnerAddress } = req.body;
        if (!winnerAddress) {
            return res.status(400).json({ error: "Missing winnerAddress" });
        }

        memoryDb[winnerAddress] = (memoryDb[winnerAddress] || 0) + 1;

        return res.status(200).json({ success: true, newScore: memoryDb[winnerAddress] });
    }

    return res.status(405).json({ error: "Method not allowed" });
}
