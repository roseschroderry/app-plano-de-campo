-- ============================================================
-- PLANO DE CAMPO ATAQ — Schema Supabase
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

-- ---- 1. REGIÕES (referência) --------------------------------
CREATE TABLE IF NOT EXISTS regioes (
  id          TEXT PRIMARY KEY,
  nome        TEXT NOT NULL,
  regiao      TEXT NOT NULL,
  short_name  TEXT NOT NULL
);

INSERT INTO regioes VALUES
  ('agreste1',   'AGRESTE — Supervisor 1', 'AGRESTE',      'AGRESTE_SUP1'),
  ('agreste2',   'AGRESTE — Supervisor 2', 'AGRESTE',      'AGRESTE_SUP2'),
  ('sertao',     'SERTÃO',                 'SERTÃO',       'SERTAO'),
  ('distaq',     'DISTAQ',                 'DISTAQ',       'DISTAQ'),
  ('zonadamata', 'ZONA DA MATA',           'ZONA DA MATA', 'ZONA_DA_MATA')
ON CONFLICT DO NOTHING;

-- ---- 2. USUÁRIOS (perfis) -----------------------------------
-- user_id referencia auth.users (Supabase Auth)
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       TEXT,
  nome        TEXT,
  papel       TEXT NOT NULL CHECK (papel IN ('admin','supervisor')),
  regiao_id   TEXT REFERENCES regioes(id),   -- NULL para admin
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: cria perfil automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO usuarios (id, email, nome, papel)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'nome', 'supervisor')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---- 3. CLIENTES (plano de campo) ---------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id          BIGSERIAL PRIMARY KEY,
  regiao_id   TEXT NOT NULL REFERENCES regioes(id),
  sv          TEXT,
  cod_vd      TEXT,
  vendedor    TEXT,
  cnpj        TEXT,
  codigo      TEXT,
  razao       TEXT,
  fantasia    TEXT,
  bairro      TEXT,
  cidade      TEXT,
  praca       TEXT,
  atividade   TEXT,
  freq        TEXT NOT NULL CHECK (freq IN ('A','B','S')),
  dias        TEXT[] NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (regiao_id, cod_vd, codigo)
);

CREATE INDEX IF NOT EXISTS idx_clientes_regiao ON clientes(regiao_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cod_vd ON clientes(cod_vd);

-- ---- 4. METADADOS DE UPLOAD ---------------------------------
CREATE TABLE IF NOT EXISTS uploads (
  id          BIGSERIAL PRIMARY KEY,
  regiao_id   TEXT NOT NULL REFERENCES regioes(id) UNIQUE,
  file_name   TEXT,
  total       INT,
  uploaded_by UUID REFERENCES usuarios(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- 5. MODIFICAÇÕES ----------------------------------------
CREATE TABLE IF NOT EXISTS modificacoes (
  id          BIGSERIAL PRIMARY KEY,
  regiao_id   TEXT NOT NULL REFERENCES regioes(id),
  usuario_id  UUID REFERENCES usuarios(id),
  usuario_nome TEXT,
  cliente_id  BIGINT REFERENCES clientes(id),
  cliente_nome TEXT,
  cliente_cod  TEXT,
  cidade       TEXT,
  vendedor     TEXT,
  cod_vd       TEXT,
  alteracoes   JSONB NOT NULL DEFAULT '[]',
  obs          TEXT,
  aplicado     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mods_regiao ON modificacoes(regiao_id);
CREATE INDEX IF NOT EXISTS idx_mods_aplicado ON modificacoes(aplicado);

-- ---- 6. AJUSTES ---------------------------------------------
CREATE TABLE IF NOT EXISTS ajustes (
  id           BIGSERIAL PRIMARY KEY,
  regiao_id    TEXT NOT NULL REFERENCES regioes(id),
  usuario_id   UUID REFERENCES usuarios(id),
  usuario_nome TEXT,
  vendedor     TEXT,
  cod_vd       TEXT,
  cliente_nome TEXT,
  texto        TEXT NOT NULL,
  status       TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','resolvido')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_regiao ON ajustes(regiao_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_status ON ajustes(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE regioes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE modificacoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes        ENABLE ROW LEVEL SECURITY;

-- Helper: papel do usuário logado
CREATE OR REPLACE FUNCTION meu_papel() RETURNS TEXT LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT papel FROM usuarios WHERE id = auth.uid();
$$;

-- Helper: região do usuário logado
CREATE OR REPLACE FUNCTION minha_regiao() RETURNS TEXT LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT regiao_id FROM usuarios WHERE id = auth.uid();
$$;

-- regioes: todos leem
CREATE POLICY "regioes_select" ON regioes FOR SELECT USING (TRUE);

-- usuarios: cada um lê o próprio; admin lê todos
CREATE POLICY "usuarios_self" ON usuarios FOR SELECT
  USING (id = auth.uid() OR meu_papel() = 'admin');
CREATE POLICY "usuarios_update_self" ON usuarios FOR UPDATE
  USING (id = auth.uid());

-- clientes: supervisor só acessa sua região; admin acessa tudo
CREATE POLICY "clientes_select" ON clientes FOR SELECT
  USING (meu_papel() = 'admin' OR regiao_id = minha_regiao());
CREATE POLICY "clientes_insert" ON clientes FOR INSERT
  WITH CHECK (meu_papel() = 'admin' OR regiao_id = minha_regiao());
CREATE POLICY "clientes_update" ON clientes FOR UPDATE
  USING (meu_papel() = 'admin' OR regiao_id = minha_regiao());
CREATE POLICY "clientes_delete" ON clientes FOR DELETE
  USING (meu_papel() = 'admin');

-- uploads: supervisor só vê/altera a sua; admin tudo
CREATE POLICY "uploads_select" ON uploads FOR SELECT
  USING (meu_papel() = 'admin' OR regiao_id = minha_regiao());
CREATE POLICY "uploads_upsert" ON uploads FOR ALL
  USING (meu_papel() = 'admin' OR regiao_id = minha_regiao());

-- modificacoes: supervisor só vê as da sua região; admin vê tudo
CREATE POLICY "mods_select" ON modificacoes FOR SELECT
  USING (meu_papel() = 'admin' OR regiao_id = minha_regiao());
CREATE POLICY "mods_insert" ON modificacoes FOR INSERT
  WITH CHECK (regiao_id = minha_regiao());
CREATE POLICY "mods_update_admin" ON modificacoes FOR UPDATE
  USING (meu_papel() = 'admin');

-- ajustes: igual
CREATE POLICY "ajustes_select" ON ajustes FOR SELECT
  USING (meu_papel() = 'admin' OR regiao_id = minha_regiao());
CREATE POLICY "ajustes_insert" ON ajustes FOR INSERT
  WITH CHECK (regiao_id = minha_regiao());
CREATE POLICY "ajustes_update_admin" ON ajustes FOR UPDATE
  USING (meu_papel() = 'admin');

-- ============================================================
-- REALTIME (assine no Dashboard > Database > Replication)
-- Habilitar nas tabelas: modificacoes, ajustes
-- ============================================================
