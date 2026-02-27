-- WhoisWho — Supabase Schema
-- Run this entire file in your Supabase SQL editor (Dashboard > SQL Editor)

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table games (
  id                  uuid default gen_random_uuid() primary key,
  room_code           text unique not null,
  status              text not null default 'waiting',
  -- waiting      : P1 created room, waiting for P2 to join
  -- ready        : P2 joined, both need to select characters
  -- in_progress  : both committed characters, game running
  -- finished     : game over

  player1_address     text not null,
  player2_address     text,

  -- Commit-reveal anti-cheat: hashes stored before characters revealed
  player1_commitment  text,    -- pedersen(char_id_felt, salt)
  player2_commitment  text,
  player1_char_id     text,    -- revealed at game end
  player2_char_id     text,
  player1_salt        text,    -- revealed at game end
  player2_salt        text,

  active_player_num   integer not null default 1,  -- 1 or 2
  winner_player_num   integer,
  turn_number         integer not null default 1,

  -- Character set snapshot (so both clients use identical characters)
  characters          jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table game_events (
  id              uuid default gen_random_uuid() primary key,
  game_id         uuid references games(id) on delete cascade not null,
  event_type      text not null,
  -- CHARACTER_COMMITTED | QUESTION_ASKED | ANSWER_GIVEN
  -- GUESS_MADE | GUESS_RESULT | CHARACTER_REVEALED

  player_num      integer not null,   -- 1 or 2
  player_address  text not null,
  turn_number     integer not null,
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index on games (room_code);
create index on games (status);
create index on game_events (game_id, created_at);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable Realtime for both tables so clients receive live updates.
-- In Supabase dashboard: Database > Replication > enable for games + game_events
-- OR run these statements:

alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_events;

-- ─── Row Level Security (MVP: open access) ────────────────────────────────────
-- For production, restrict to wallet-authenticated users.
-- For MVP, open read/write is fine since room codes act as access tokens.

alter table games enable row level security;
alter table game_events enable row level security;

create policy "Public access to games" on games
  for all using (true) with check (true);

create policy "Public access to game_events" on game_events
  for all using (true) with check (true);
