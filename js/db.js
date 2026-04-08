// ═══════════════════════════════════════════
// db.js — Supabase con interfaz síncrona
//
// ESTRATEGIA: cache local en memoria.
// - q/q1/run operan sobre un cache JSON en memoria.
// - El cache se sincroniza con Supabase en segundo plano.
// - Así el resto de módulos NO necesita await.
// ═══════════════════════════════════════════

const SUPA_URL = 'https://zbvrkvxxkmmvcehspffp.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidnJrdnh4a21tdmNlaHNwZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDk1MDcsImV4cCI6MjA5MDEyNTUwN30.pziT8afUSawL4wE1kqyqlbFoUIvcUEVhjLiXhXFJUDk';

let _sb   = null;
let _lastInsertId = null;

// ─── Cache en memoria por tabla ───────────
const _cache = {
  usuarios:     [],
  responsables: [],
  areas:        [],
  expedientes:  [],
  movimientos:  [],
  vinculos:     [],
  auditoria:    [],
};

// ─── Catálogos (acceso rápido) ────────────
export let _areas        = [];
export let _responsables = [];

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
export async function initDB() {
  if (!window.supabase)
    throw new Error('Supabase no cargó. Verifica tu conexión a internet.');

  _sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false }
  });

  // Probar conexión
  const { error } = await _sb.from('usuarios').select('id').limit(1);
  if (error) throw new Error(`Sin conexión a la base de datos: ${error.message}`);

  // Cargar todas las tablas al cache
  await _loadAllCache();
  _updateExports();
}

export function saveDB() {} // No-op — Supabase persiste automáticamente

// ═══════════════════════════════════════════
// CARGA DE CACHE
// ═══════════════════════════════════════════
async function _loadAllCache() {
  const tablas = ['usuarios','responsables','areas','expedientes','movimientos','vinculos','auditoria'];
  await Promise.all(tablas.map(async tabla => {
    const { data, error } = await _sb.from(tabla).select('*').order('id');
    if (!error && data) _cache[tabla] = data;
  }));
}

async function _loadTable(tabla) {
  const { data, error } = await _sb.from(tabla).select('*').order('id');
  if (!error && data) _cache[tabla] = data;
}

function _updateExports() {
  _areas        = _cache.areas.filter(a => a.activa);
  _responsables = _cache.responsables.filter(r => r.activo);
}

export async function reloadCache() {
  await _loadAllCache();
  _updateExports();
}

// ═══════════════════════════════════════════
// QUERY HELPERS — interfaz síncrona sobre cache
// ═══════════════════════════════════════════

/**
 * q() — filtra el cache en memoria con una función JS.
 * Para queries simples usa _qCache().
 * Para queries complejas con JOIN usa _qSupabase() (async).
 *
 * Dado que la mayoría de módulos hacen queries simples,
 * usamos el cache. Los JOINs complejos se hacen via
 * funciones específicas en cada módulo usando getSB().
 */
export function q(sql, params = []) {
  // Detectar tabla principal del SQL
  const tabla = _detectTable(sql);
  if (!tabla) return [];
  const rows = _cache[tabla] || [];

  // Para queries simples sin JOIN retornar directo
  if (!sql.toLowerCase().includes('join')) {
    return _filterRows(rows, sql, params);
  }

  // Para JOINs: retornar vacío y forzar uso de getSB() directamente
  // Los módulos que necesiten JOINs deben usar qAsync()
  console.warn('[DB] JOIN detectado en q() síncrono — usa qAsync():', sql.substring(0,60));
  return [];
}

export function q1(sql, params = []) {
  return q(sql, params)[0] || null;
}

/**
 * qAsync() — para queries con JOINs complejos.
 * Retorna Promise. Usado en buscar.js y verDetalle.
 */
export async function qAsync(sql, params = []) {
  try {
    const { data, error } = await _sb.rpc('exec_sql', {
      sql_query: _interpolate(sql, params)
    });
    if (error) { console.error('[DB qAsync]', error.message); return []; }
    return data || [];
  } catch(e) { console.error('[DB qAsync]', e.message); return []; }
}

export async function q1Async(sql, params = []) {
  const rows = await qAsync(sql, params);
  return rows[0] || null;
}

/**
 * run() — escribe en Supabase Y actualiza cache local.
 * Síncrono en apariencia (no bloquea UI), async en background.
 */
export function run(sql, params = []) {
  const tabla = _detectTable(sql);
  _runAsync(sql, params, tabla); // fire and forget
  return true;
}

async function _runAsync(sql, params, tabla) {
  try {
    const sqlFinal = _interpolate(sql, params);
    const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
    const isUpdate = sql.trim().toUpperCase().startsWith('UPDATE');
    const isDelete = sql.trim().toUpperCase().startsWith('DELETE');

    if (isInsert && tabla) {
      // Parsear valores e insertar via Supabase nativo
      const obj = _parseInsert(sql, params);
      if (obj) {
        const { data, error } = await _sb.from(tabla).insert(obj).select().single();
        if (!error && data) {
          _lastInsertId = data.id;
          _cache[tabla] = [...(_cache[tabla]||[]), data];
          _updateExports();
        } else if (error) {
          console.error('[DB insert]', error.message);
        }
        return;
      }
    }

    if (isUpdate && tabla) {
      const { set, where } = _parseUpdate(sql, params);
      if (set && where) {
        const { error } = await _sb.from(tabla).update(set).match(where);
        if (!error) {
          await _loadTable(tabla);
          _updateExports();
        } else console.error('[DB update]', error.message);
        return;
      }
    }

    // Fallback: exec_sql para casos complejos
    const { data, error } = await _sb.rpc('exec_sql', { sql_query: _interpolate(sql, params) });
    if (error) console.error('[DB run fallback]', error.message);
    else if (tabla) { await _loadTable(tabla); _updateExports(); }
    if (data?.[0]?.id) _lastInsertId = data[0].id;

  } catch(e) { console.error('[DB _runAsync]', e.message); }
}

export function lastId() { return _lastInsertId; }
export function getSB()  { return _sb; }

// ═══════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════

function _detectTable(sql) {
  const m = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
  return m ? m[1].toLowerCase() : null;
}

function _filterRows(rows, sql, params) {
  // Para ORDER BY, LIMIT simples aplicar en memoria
  let result = [...rows];
  const sqlUp = sql.toUpperCase();

  // WHERE id = ?
  const whereId = sql.match(/WHERE\s+\w+\.?id\s*=\s*\?/i);
  if (whereId && params.length) {
    const idVal = params[params.length - 1]; // último param suele ser el id en WHERE
    result = result.filter(r => String(r.id) === String(idVal));
  }

  // WHERE username = ?
  const whereUser = sql.match(/WHERE\s+username\s*=\s*\?/i);
  if (whereUser && params[0]) {
    result = result.filter(r => r.username === params[0]);
  }

  // WHERE activo/activa = 1/true
  if (sqlUp.includes('ACTIVO=1') || sqlUp.includes("ACTIVO = 1") || sqlUp.includes('ACTIVO=TRUE')) {
    result = result.filter(r => r.activo === true || r.activo === 1);
  }
  if (sqlUp.includes('ACTIVA=1') || sqlUp.includes('ACTIVA=TRUE')) {
    result = result.filter(r => r.activa === true || r.activa === 1);
  }

  // WHERE expediente_id = ?
  const whereExpId = sql.match(/WHERE\s+\w+\.?expediente_id\s*=\s*\?/i);
  if (whereExpId && params[0]) {
    result = result.filter(r => String(r.expediente_id) === String(params[0]));
  }

  // ORDER BY ... DESC / ASC
  const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)\s*(DESC|ASC)?/i);
  if (orderMatch) {
    const col = orderMatch[1].toLowerCase();
    const desc = (orderMatch[2]||'').toUpperCase() === 'DESC';
    result.sort((a, b) => {
      if (a[col] < b[col]) return desc ? 1 : -1;
      if (a[col] > b[col]) return desc ? -1 : 1;
      return 0;
    });
  }

  // LIMIT
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) result = result.slice(0, parseInt(limitMatch[1]));

  return result;
}

function _parseInsert(sql, params) {
  // INSERT INTO tabla(col1,col2,...) VALUES(?,?,...)
  const m = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!m) return null;
  const cols = m[1].split(',').map(c => c.trim());
  const obj  = {};
  cols.forEach((col, i) => {
    const val = params[i];
    obj[col] = (val === null || val === undefined) ? null : val;
  });
  return obj;
}

function _parseUpdate(sql, params) {
  // UPDATE tabla SET col=?,col=? WHERE id=?
  const setMatch   = sql.match(/SET\s+(.+?)\s+WHERE/i);
  const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
  if (!setMatch || !whereMatch) return { set: null, where: null };

  const setCols  = setMatch[1].split(',').map(s => s.trim().split(/\s*=\s*/)[0].trim());
  const whereCol = whereMatch[1].trim();
  const set      = {};
  const nParams  = setCols.length;

  setCols.forEach((col, i) => { set[col] = params[i] ?? null; });

  const whereVal = params[nParams];
  const where    = { [whereCol]: whereVal };

  return { set, where };
}

function _interpolate(sql, params) {
  if (!params?.length) return sql;
  let i = 0;
  return sql.replace(/\?/g, () => {
    const val = params[i++];
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return `'${String(val).replace(/'/g, "''")}'`;
  });
}

// ─── Realtime ────────────────────────────
export function suscribirRealtime(onCambio) {
  _sb.channel('gdti-cambios')
    .on('postgres_changes', { event:'*', schema:'public', table:'expedientes' }, async () => {
      await _loadTable('expedientes');
      onCambio?.('expedientes');
    })
    .on('postgres_changes', { event:'*', schema:'public', table:'movimientos' }, async () => {
      await _loadTable('movimientos');
      onCambio?.('movimientos');
    })
    .subscribe();
}
