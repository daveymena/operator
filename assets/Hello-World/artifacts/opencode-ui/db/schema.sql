-- ============================================================
-- OpenCode Evolved — Esquema de base de datos
-- Compatible con: PostgreSQL 13+ (Easypanel, Supabase, local)
-- Ejecutar: psql $DATABASE_URL -f schema.sql
-- ============================================================

-- UUID nativo de PostgreSQL 13+ (sin extensión extra)
-- Fallback a uuid-ossp para compatibilidad máxima
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Función UUID compatible con todos los PostgreSQL
CREATE OR REPLACE FUNCTION gen_uuid()
RETURNS UUID AS $$
BEGIN
  -- PostgreSQL 13+: gen_random_uuid() nativo
  RETURN gen_random_uuid();
EXCEPTION WHEN undefined_function THEN
  -- Fallback para PostgreSQL < 13
  RETURN uuid_generate_v4();
END;
$$ LANGUAGE plpgsql;

-- ── Sesiones de chat (sincronizado con OpenCode) ──────────────
CREATE TABLE IF NOT EXISTS sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oc_id        TEXT UNIQUE,
  title        TEXT,
  project_path TEXT,
  model        TEXT,
  provider     TEXT,
  message_count INT DEFAULT 0,
  total_tokens  BIGINT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Mensajes de cada sesión ──────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content    TEXT,
  model      TEXT,
  provider   TEXT,
  tokens_in  INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  tool_name  TEXT,
  tool_result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Memoria de IA (snapshots del memory.md) ───────────────────
CREATE TABLE IF NOT EXISTS ai_memory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL,
  word_count INT,
  source     TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Proyectos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  path          TEXT UNIQUE NOT NULL,
  description   TEXT,
  language      TEXT,
  git_remote    TEXT,
  last_opened   TIMESTAMPTZ DEFAULT NOW(),
  session_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Configuración de usuario ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Uso de modelos de IA (estadísticas) ──────────────────────
CREATE TABLE IF NOT EXISTS model_usage (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model      TEXT NOT NULL,
  provider   TEXT,
  tokens_in  BIGINT DEFAULT 0,
  tokens_out BIGINT DEFAULT 0,
  requests   INT DEFAULT 1,
  cost_usd   NUMERIC(10,6) DEFAULT 0,
  date       DATE DEFAULT CURRENT_DATE,
  UNIQUE(model, date)
);

-- ── Tareas del agente (body controller) ──────────────────────
CREATE TABLE IF NOT EXISTS agent_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  result      TEXT,
  error       TEXT,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Capturas de pantalla / visión ────────────────────────────
CREATE TABLE IF NOT EXISTS vision_captures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  description TEXT,
  model_used  TEXT,
  file_path   TEXT,
  mime_type   TEXT DEFAULT 'image/png',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
--  ÍNDICES
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_sessions_updated    ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_project    ON sessions(project_path);
CREATE INDEX IF NOT EXISTS idx_messages_session    ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role       ON messages(role);
CREATE INDEX IF NOT EXISTS idx_model_usage_date    ON model_usage(date DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_model   ON model_usage(model);
CREATE INDEX IF NOT EXISTS idx_projects_opened     ON projects(last_opened DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status  ON agent_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_session ON agent_tasks(session_id);

-- ════════════════════════════════════════════════════════════
--  TRIGGER: actualizar updated_at automáticamente
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_sessions_updated
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_ai_memory_updated
    BEFORE UPDATE ON ai_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════════════════════════════════════════════════════════
--  DATOS INICIALES
-- ════════════════════════════════════════════════════════════
INSERT INTO user_settings (key, value) VALUES
  ('theme',          '"dark"'),
  ('language',       '"es"'),
  ('auto_save',      'true'),
  ('model',          '"openai/gpt-4o"'),
  ('vision_enabled', 'true'),
  ('body_enabled',   'true'),
  ('timezone',       '"America/Bogota"')
ON CONFLICT (key) DO NOTHING;
