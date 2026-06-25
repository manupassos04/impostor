-- =========================================
-- Impostor - Schema do Supabase
-- Cole este SQL no SQL Editor do Supabase
-- =========================================

-- Tabela de salas
CREATE TABLE IF NOT EXISTS impostor_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'role_reveal', 'hints', 'voting', 'result')),
  secret_word TEXT,
  category TEXT,
  host_player_id UUID,
  current_hint_seat INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de jogadores
CREATE TABLE IF NOT EXISTS impostor_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES impostor_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  seat_order INTEGER,
  is_impostor BOOLEAN NOT NULL DEFAULT FALSE,
  hint TEXT,
  voted_for UUID,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Segurança permissiva (jogo público)
ALTER TABLE impostor_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE impostor_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acesso_publico_impostor_rooms" ON impostor_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acesso_publico_impostor_players" ON impostor_players FOR ALL USING (true) WITH CHECK (true);

-- Ativar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE impostor_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE impostor_players;
