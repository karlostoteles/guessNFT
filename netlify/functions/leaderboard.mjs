/**
 * Netlify serverless function — Leaderboard.
 *
 * Reads finished games from the Supabase `games` table and returns the
 * top 50 players ranked by win count.
 *
 * Usage: /api/leaderboard  (routed via netlify.toml redirect)
 *
 * Returns: { entries: Array<{ address: string; wins: number }> }
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('placeholder')) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({ entries: [] }),
    };
  }

  try {
    // Fetch all finished games that have a declared winner.
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/games?select=player1_address,player2_address,winner_player_num&status=eq.finished&winner_player_num=not.is.null`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      return {
        statusCode: resp.status,
        headers: corsHeaders(),
        body: JSON.stringify({ error: text }),
      };
    }

    const games = await resp.json();

    // Tally wins per wallet address.
    const wins = new Map();
    for (const game of games) {
      const winner =
        game.winner_player_num === 1 ? game.player1_address : game.player2_address;
      if (winner) {
        wins.set(winner, (wins.get(winner) ?? 0) + 1);
      }
    }

    const entries = Array.from(wins.entries())
      .map(([address, w]) => ({ address, wins: w }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 50);

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
      body: JSON.stringify({ entries }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
