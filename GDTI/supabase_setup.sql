-- ================================================================
-- GDTI — Setup Supabase (IDs INTEGER)
-- Ejecutar en: Supabase > SQL Editor > New query
-- ================================================================

-- Limpiar todo si ya existía
DROP TABLE IF EXISTS auditoria    CASCADE;
DROP TABLE IF EXISTS vinculos     CASCADE;
DROP TABLE IF EXISTS movimientos  CASCADE;
DROP TABLE IF EXISTS expedientes  CASCADE;
DROP TABLE IF EXISTS areas        CASCADE;
DROP TABLE IF EXISTS responsables CASCADE;
DROP TABLE IF EXISTS usuarios     CASCADE;
DROP FUNCTION IF EXISTS exec_sql(TEXT);

-- ── 1. FUNCIÓN exec_sql ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSONB;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql_query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'SQL Error: %', SQLERRM;
END;
$$;

-- ── 2. TABLAS ────────────────────────────────────────────────────
CREATE TABLE usuarios (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre          TEXT NOT NULL,
  username        TEXT UNIQUE NOT NULL,
  password        TEXT NOT NULL,
  rol             TEXT NOT NULL DEFAULT 'visualizador',
  area            TEXT,
  activo          BOOLEAN DEFAULT true,
  intentos        INTEGER DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE responsables (
  id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL,
  cargo  TEXT,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE areas (
  id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL,
  sigla  TEXT,
  tipo   TEXT DEFAULT 'INTERNA',
  activa BOOLEAN DEFAULT true
);

CREATE TABLE expedientes (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  anio              INTEGER NOT NULL,
  nro               INTEGER NOT NULL,
  codigo            TEXT UNIQUE NOT NULL,
  origen            TEXT NOT NULL,
  codigo_origen     TEXT,
  origen_desc       TEXT,
  gm_adjuntas       TEXT,
  fecha_ingreso     DATE NOT NULL,
  cabecera          TEXT,
  asunto            TEXT NOT NULL,
  folios            INTEGER,
  adj_copia         INTEGER DEFAULT 0,
  adj_orig          INTEGER DEFAULT 0,
  adj_cd            INTEGER DEFAULT 0,
  adj_usb           INTEGER DEFAULT 0,
  responsable_id    INTEGER REFERENCES responsables(id),
  responsable_otros TEXT,
  fecha_entrega_resp DATE,
  estado            TEXT DEFAULT 'EN TRÁMITE',
  observaciones     TEXT,
  registrado_por    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anio, nro)
);

CREATE TABLE movimientos (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,
  fecha         DATE NOT NULL,
  area_id       INTEGER REFERENCES areas(id),
  area_libre    TEXT,
  cabecera      TEXT,
  responsable   TEXT,
  medio         TEXT,
  observaciones TEXT,
  usuario       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vinculos (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exp_origen  INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  exp_destino INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  tipo        TEXT DEFAULT 'RELACIONADO',
  nota        TEXT,
  creado_por  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auditoria (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario           TEXT NOT NULL,
  rol               TEXT,
  accion            TEXT NOT NULL,
  tabla             TEXT,
  registro_id       TEXT,
  expediente_codigo TEXT,
  detalle           TEXT,
  valor_anterior    TEXT,
  fecha_hora        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. DESHABILITAR RLS ──────────────────────────────────────────
ALTER TABLE usuarios     DISABLE ROW LEVEL SECURITY;
ALTER TABLE responsables DISABLE ROW LEVEL SECURITY;
ALTER TABLE areas        DISABLE ROW LEVEL SECURITY;
ALTER TABLE expedientes  DISABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos  DISABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos     DISABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria    DISABLE ROW LEVEL SECURITY;

-- ── 4. REALTIME ──────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE expedientes;
ALTER PUBLICATION supabase_realtime ADD TABLE movimientos;

-- ── 5. DATOS INICIALES ───────────────────────────────────────────
-- SHA-256: admin123 | ed123 | vis123
INSERT INTO usuarios (nombre, username, password, rol, area) VALUES
  ('Administrador del Sistema','admin',
   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9','admin','GDTI'),
  ('Editor Principal','editor',
   '0f8e5c827988bd5d11f5591b93773c63d1041d3bdb8b87a5ef05b5cbb3e57c8e','editor','Mesa de Partes GDTI'),
  ('Visualizador','vista',
   'e30a7e0f5c0b39de29be5c0f91cfe6a1c09a5f2e6c8f32e8b7a3ec84a23c5ff3','visualizador','Consulta')
ON CONFLICT (username) DO NOTHING;

INSERT INTO responsables (nombre, cargo) VALUES
  ('Brandy','Asistente – elabora informe de respuesta'),
  ('Arq. Jason','Arquitecto – revisión técnica y resoluciones'),
  ('Ing. Ronald','Ingeniero – conocimiento y seguimiento'),
  ('Sra. Lida','Asistente administrativa'),
  ('Otros','Especificar en campo adicional');

INSERT INTO areas (nombre, sigla, tipo) VALUES
  ('Gerencia de Desarrollo Territorial e Infraestructura','GDTI','INTERNA'),
  ('Sub Gerencia de Infraestructura','SGI','INTERNA'),
  ('Sub Gerencia de Desarrollo Territorial (Catastro)','SGDT','INTERNA'),
  ('Oficina de Gestión del Riesgo de Desastres','OGRD','INTERNA'),
  ('Oficina de Obras Públicas (vía SGI)','SGI-OOP','INTERNA'),
  ('Oficina de Estudios y Proyectos (vía SGI)','SGI-OEP','INTERNA'),
  ('Oficina de Formulación de Inversiones (vía SGI)','SGI-OFI','INTERNA'),
  ('Gerencia Municipal','GM','MUNICIPAL'),
  ('Alcaldía','ALC','MUNICIPAL'),
  ('Mesa de Partes Municipal','MP','MUNICIPAL'),
  ('Secretaría General','SG','MUNICIPAL'),
  ('Otras instituciones externas','EXT','EXTERNA');

-- ── VERIFICACIÓN: debe listar 7 tablas ───────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
