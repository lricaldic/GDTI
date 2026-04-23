// ═══════════════════════════════════════════
// db.js — Supabase + cache en memoria
// ESTRATEGIA CORREGIDA:
// - runAsync siempre recarga la tabla afectada tras insertar/actualizar
// - reloadCache recarga TODO desde Supabase
// - q/q1 leen del cache actualizado
// ═══════════════════════════════════════════

const SUPA_URL = 'https://zbvrkvxxkmmvcehspffp.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidnJrdnh4a21tdmNlaHNwZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDk1MDcsImV4cCI6MjA5MDEyNTUwN30.pziT8afUSawL4wE1kqyqlbFoUIvcUEVhjLiXhXFJUDk';

let _sb = null;
let _lastInsertId = null;
let _connStatus = false; // estado de conexión

// ─── Cache central ────────────────────────
// Un solo objeto mutable — todos los módulos
// leen del mismo objeto, así los cambios se
// propagan sin necesidad de re-importar.
export const _cache = {
  usuarios:     [],
  responsables: [],
  areas:        [],
  expedientes:  [],
  movimientos:  [],
  vinculos:     [],
  auditoria:    [],
};

// Accesos rápidos a catálogos — GETTERS para
// siempre leer del cache actualizado
export function getAreas()        { return _cache.areas.filter(a => a.activa !== false); }
export function getResponsables() { return _cache.responsables.filter(r => r.activo !== false); }
export function getSB()           { return _sb; }
export function isConnected()     { return _connStatus; }

// Compatibilidad con módulos que usan _areas / _responsables directamente
// Son getters dinámicos, no snapshots
Object.defineProperty(exports || {}, '_areas',        { get: getAreas });
Object.defineProperty(exports || {}, '_responsables', { get: getResponsables });
// En ES modules usamos el patrón de función en su lugar (arriba)

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
export async function initDB() {
  if (!window.supabase)
    throw new Error('Supabase no cargó. Verifica tu conexión a internet.');

  _sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false }
  });

  const { error } = await _sb.from('usuarios').select('id').limit(1);
  if (error) throw new Error(`Sin conexión: ${error.message}`);

  _connStatus = true;
  await reloadCache();
}

export function saveDB() {} // no-op

// ═══════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════
export async function reloadCache() {
  const tablas = ['usuarios','responsables','areas','expedientes','movimientos','vinculos','auditoria'];
  await Promise.all(tablas.map(_loadTable));
}

export async function reloadTable(tabla) {
  await _loadTable(tabla);
}

async function _loadTable(tabla) {
  try {
    const { data, error } = await _sb.from(tabla).select('*').order('id');
    if (!error && data) _cache[tabla] = data;
  } catch(e) { console.error('[DB _loadTable]', tabla, e.message); }
}

// ═══════════════════════════════════════════
// QUERY — lee del cache
// ═══════════════════════════════════════════
export function q(sql, params = []) {
  const tabla = _detectTable(sql);
  if (!tabla || !_cache[tabla]) return [];
  if (sql.toLowerCase().includes('join')) {
    console.warn('[DB] q() no soporta JOINs, usa el cache directamente');
    return [];
  }
  return _filter(_cache[tabla], sql, params);
}

export function q1(sql, params = []) {
  return q(sql, params)[0] ?? null;
}

// ═══════════════════════════════════════════
// RUN — escribe en Supabase y actualiza cache
// ═══════════════════════════════════════════
export function run(sql, params = []) {
  // fire-and-forget para operaciones no críticas
  runAsync(sql, params).catch(e => console.error('[DB run]', e.message));
  return true;
}

export async function runAsync(sql, params = []) {
  const sqlN   = sql.replace(/\s+/g, ' ').trim();
  const tabla  = _detectTable(sqlN);
  const opType = sqlN.slice(0,6).toUpperCase();

  try {
    if (opType === 'INSERT' && tabla) {
      const obj = _parseInsert(sqlN, params);
      if (!obj) return false;
      const { data, error } = await _sb.from(tabla).insert(obj).select().single();
      if (error) { console.error('[DB INSERT]', error.message, obj); return false; }
      _lastInsertId = data.id;
      // Actualizar cache inmediatamente con el registro devuelto
      _cache[tabla] = [..._cache[tabla], data];
      return true;
    }

    if (opType === 'UPDATE' && tabla) {
      const parsed = _parseUpdate(sqlN, params);
      if (!parsed.set) return false;
      const { error } = await _sb.from(tabla).update(parsed.set).match(parsed.where);
      if (error) { console.error('[DB UPDATE]', error.message); return false; }
      // Recargar tabla para reflejar cambio
      await _loadTable(tabla);
      return true;
    }

    if (opType === 'DELETE' && tabla) {
      // DELETE manejado directamente via getSB() en los módulos
      await _loadTable(tabla);
      return true;
    }

    return false;
  } catch(e) {
    console.error('[DB runAsync]', e.message);
    return false;
  }
}

export function lastId() { return _lastInsertId; }

// ═══════════════════════════════════════════
// FILTRO EN MEMORIA
// ═══════════════════════════════════════════
function _filter(rows, sql, params) {
  let result = [...rows];
  const sqlU = sql.toUpperCase().replace(/\s+/g, ' ');

  // WHERE id = ?
  if (/WHERE\s+\w*\.?ID\s*=\s*\?/i.test(sql) && params.length) {
    const val = params.find(p => p !== null && p !== undefined);
    if (val !== undefined) result = result.filter(r => String(r.id) === String(val));
  }

  // WHERE expediente_id = ?
  if (/WHERE\s+\w*\.?EXPEDIENTE_ID\s*=\s*\?/i.test(sql) && params[0] != null) {
    result = result.filter(r => String(r.expediente_id) === String(params[0]));
  }

  // WHERE exp_origen = ? OR exp_destino = ?
  if (/EXP_ORIGEN\s*=\s*\?/i.test(sql) && params[0] != null) {
    result = result.filter(r =>
      String(r.exp_origen) === String(params[0]) ||
      String(r.exp_destino) === String(params[1] ?? params[0])
    );
  }

  // WHERE username = ?
  if (/WHERE\s+USERNAME\s*=\s*\?/i.test(sql) && params[0] != null) {
    result = result.filter(r => r.username === params[0]);
  }

  // WHERE activo = 1 / activa = 1
  if (/ACTIVO\s*=\s*1/i.test(sql) || /ACTIVO\s*=\s*TRUE/i.test(sql)) {
    result = result.filter(r => r.activo === true || r.activo === 1);
  }
  if (/ACTIVA\s*=\s*1/i.test(sql) || /ACTIVA\s*=\s*TRUE/i.test(sql)) {
    result = result.filter(r => r.activa === true || r.activa === 1);
  }

  // ORDER BY col DESC/ASC
  const ord = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(DESC|ASC))?/i);
  if (ord) {
    const col  = ord[1].toLowerCase();
    const desc = (ord[2]||'').toUpperCase() === 'DESC';
    result.sort((a, b) => {
      const va = a[col] ?? '', vb = b[col] ?? '';
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
      return 0;
    });
  }

  // LIMIT n
  const lim = sql.match(/LIMIT\s+(\d+)/i);
  if (lim) result = result.slice(0, parseInt(lim[1]));

  return result;
}

// ═══════════════════════════════════════════
// PARSEO DE SQL
// ═══════════════════════════════════════════
function _detectTable(sql) {
  const m = sql.replace(/\s+/g,' ').match(/(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
  return m ? m[1].toLowerCase() : null;
}

function _parseInsert(sql, params) {
  const m = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*VALUES\s*\([^)]+\)/i);
  if (!m) return null;
  const cols = m[1].split(',').map(c => c.trim());
  const obj  = {};
  cols.forEach((col, i) => {
    obj[col] = params[i] === undefined ? null : (params[i] === '' ? null : params[i]);
  });
  return obj;
}

function _parseUpdate(sql, params) {
  const setM   = sql.match(/SET\s+(.+?)\s+WHERE/i);
  const whereM = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
  if (!setM || !whereM) return { set: null, where: null };
  const cols = setM[1].split(',').map(s => s.trim().replace(/\s*=\s*\?.*/, '').trim());
  const set  = {};
  cols.forEach((col, i) => { set[col] = params[i] ?? null; });
  return { set, where: { [whereM[1]]: params[cols.length] } };
}

// ═══════════════════════════════════════════
// REALTIME — sincronización automática
// ═══════════════════════════════════════════
export function suscribirRealtime(onCambio) {
  if (!_sb) return;
  _sb.channel('gdti-rt')
    .on('postgres_changes',{ event:'*', schema:'public', table:'expedientes' }, async () => {
      await _loadTable('expedientes');
      onCambio?.('expedientes');
    })
    .on('postgres_changes',{ event:'*', schema:'public', table:'movimientos' }, async () => {
      await _loadTable('movimientos');
      onCambio?.('movimientos');
    })
    .subscribe(status => {
      _connStatus = status === 'SUBSCRIBED';
    });
}
