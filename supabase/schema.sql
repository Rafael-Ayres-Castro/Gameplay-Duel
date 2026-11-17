-- =========================================================
-- Desafio Gameplay — schema do Supabase
-- Cole tudo no SQL Editor do Supabase e clique em "Run".
-- =========================================================

-- Jogadores (sempre 2: id 1 e id 2)
create table if not exists public.players (
  id         smallint primary key check (id in (1, 2)),
  name       text not null check (char_length(name) between 1 and 24),
  nickname   text check (char_length(nickname) <= 12),
  color      text not null default '#1EF2C2' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

insert into public.players (id, name, nickname, color) values
  (1, 'Jogador 1', 'P1', '#1EF2C2'),
  (2, 'Jogador 2', 'P2', '#F5C84C')
on conflict (id) do nothing;

-- Partidas
create table if not exists public.matches (
  id               bigint generated always as identity primary key,
  game             text not null check (game in (
                     'fifa', 'rocket_league', 'clash_royale', 'minecraft',
                     'fall_guys', 'gang_beasts', 'plato')),
  player1_score    integer not null default 0 check (player1_score between 0 and 999),
  player2_score    integer not null default 0 check (player2_score between 0 and 999),
  winner           smallint references public.players (id),  -- null = empate
  duration_minutes integer check (duration_minutes between 0 and 1440),
  notes            text check (char_length(notes) <= 500),
  details          jsonb not null default '{}'::jsonb,       -- modo + estatísticas extras
  played_at        timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists matches_played_at_idx on public.matches (played_at);
create index if not exists matches_game_idx on public.matches (game);

-- Segurança: RLS ligado e SEM policies.
-- Ninguém acessa pela chave pública (anon). Só o backend no Render,
-- que usa a service_role key (ela ignora o RLS), lê e grava.
alter table public.players enable row level security;
alter table public.matches enable row level security;
