import { supabase } from './client';
import type { SupabaseGame, SupabaseGameEvent, OnlineEventType } from './types';
import type { Character } from '@/core/data/characters';

function generateRoomCode(): string {
  // Alphanumeric, no ambiguous chars (0/O, 1/I/l)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createGame(
  playerAddress: string,
  characters: Character[]
): Promise<{ game: SupabaseGame; playerNum: 1 }> {
  const room_code = generateRoomCode();

  const { data, error } = await supabase
    .from('games')
    .insert({
      room_code,
      status: 'waiting',
      player1_address: playerAddress,
      characters: characters as any[],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create game: ${error.message}`);
  return { game: data as SupabaseGame, playerNum: 1 };
}

export async function joinGame(
  roomCode: string,
  playerAddress: string
): Promise<{ game: SupabaseGame; playerNum: 2 }> {
  const { data: existing, error: findError } = await supabase
    .from('games')
    .select()
    .eq('room_code', roomCode.toUpperCase().trim())
    .eq('status', 'waiting')
    .single();

  if (findError || !existing) throw new Error('Game not found or already started');

  if (existing.player1_address === playerAddress) {
    throw new Error('You created this game — share the code with a friend!');
  }

  const { data, error } = await supabase
    .from('games')
    .update({
      player2_address: playerAddress,
      status: 'ready',
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw new Error(`Failed to join game: ${error.message}`);
  return { game: data as SupabaseGame, playerNum: 2 };
}

export async function sendEvent(
  gameId: string,
  eventType: OnlineEventType,
  playerNum: 1 | 2,
  playerAddress: string,
  turnNumber: number,
  payload: Record<string, any> = {}
): Promise<void> {
  const { error } = await supabase.from('game_events').insert({
    game_id: gameId,
    event_type: eventType,
    player_num: playerNum,
    player_address: playerAddress,
    turn_number: turnNumber,
    payload,
  });

  if (error) throw new Error(`Failed to send event ${eventType}: ${error.message}`);
}

export async function submitCommitment(
  gameId: string,
  playerNum: 1 | 2,
  commitment: string,
  playerAddress: string,
  turnNumber: number
): Promise<void> {
  const field = playerNum === 1 ? 'player1_commitment' : 'player2_commitment';

  await supabase
    .from('games')
    .update({ [field]: commitment, updated_at: new Date().toISOString() })
    .eq('id', gameId);

  await sendEvent(gameId, 'CHARACTER_COMMITTED', playerNum, playerAddress, turnNumber, {
    commitment,
  });

  // Check if both committed — if so, transition to in_progress
  const { data: game } = await supabase
    .from('games')
    .select('player1_commitment, player2_commitment')
    .eq('id', gameId)
    .single();

  if (game?.player1_commitment && game?.player2_commitment) {
    await supabase
      .from('games')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', gameId);
  }
}

export async function updateTurn(
  gameId: string,
  activePlayerNum: 1 | 2,
  turnNumber: number
): Promise<void> {
  await supabase
    .from('games')
    .update({
      active_player_num: activePlayerNum,
      turn_number: turnNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId);
}

export async function finishGame(
  gameId: string,
  winnerPlayerNum: 1 | 2
): Promise<void> {
  await supabase
    .from('games')
    .update({
      status: 'finished',
      winner_player_num: winnerPlayerNum,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId);
}

export async function revealCharacter(
  gameId: string,
  playerNum: 1 | 2,
  characterId: string,
  salt: string,
  playerAddress: string,
  turnNumber: number
): Promise<void> {
  const charField = playerNum === 1 ? 'player1_char_id' : 'player2_char_id';
  const saltField = playerNum === 1 ? 'player1_salt' : 'player2_salt';

  await supabase
    .from('games')
    .update({
      [charField]: characterId,
      [saltField]: salt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId);

  await sendEvent(gameId, 'CHARACTER_REVEALED', playerNum, playerAddress, turnNumber, {
    character_id: characterId,
    salt,
  });
}

export async function getGame(gameId: string): Promise<SupabaseGame | null> {
  const { data, error } = await supabase
    .from('games')
    .select()
    .eq('id', gameId)
    .single();

  if (error) return null;
  return data as SupabaseGame;
}

export async function getPastEvents(gameId: string): Promise<SupabaseGameEvent[]> {
  const { data, error } = await supabase
    .from('game_events')
    .select()
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []) as SupabaseGameEvent[];
}

export function subscribeToGame(
  gameId: string,
  onUpdate: (game: SupabaseGame) => void
) {
  return supabase
    .channel(`game-meta:${gameId}`)
    .on(
      'postgres_changes' as any,
      { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      (payload: any) => onUpdate(payload.new as SupabaseGame)
    )
    .subscribe();
}

export function subscribeToEvents(
  gameId: string,
  onEvent: (event: SupabaseGameEvent) => void
) {
  return supabase
    .channel(`game-events:${gameId}`)
    .on(
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` },
      (payload: any) => onEvent(payload.new as SupabaseGameEvent)
    )
    .subscribe();
}
export async function getActiveGamesForAddress(
  address: string
): Promise<SupabaseGame[]> {
  const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('games')
    .select()
    .or(`player1_address.eq.${address},player2_address.eq.${address}`)
    .neq('status', 'finished')
    .gt('updated_at', ONE_HOUR_AGO)
    .order('updated_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as SupabaseGame[];
}

export async function deleteGame(gameId: string): Promise<void> {
  // Delete game events first (on delete cascade should be off by default usually)
  await supabase.from('game_events').delete().eq('game_id', gameId);
  const { error } = await supabase.from('games').delete().eq('id', gameId);
  if (error) throw new Error(`Failed to delete game: ${error.message}`);
}

export async function cleanupOldGames(): Promise<number> {
  const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Find old games to cleanup events too
  const { data: oldGames } = await supabase
    .from('games')
    .select('id')
    .lt('updated_at', ONE_HOUR_AGO);
  
  if (!oldGames || oldGames.length === 0) return 0;
  
  const ids = oldGames.map(g => g.id);
  
  // Cleanup events first
  await supabase.from('game_events').delete().in('game_id', ids);
  
  // Cleanup games
  const { error, count } = await supabase
    .from('games')
    .delete({ count: 'exact' })
    .in('id', ids);
    
  if (error) {
    console.error('Cleanup failed:', error);
    return 0;
  }
  return count || 0;
}
