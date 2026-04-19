// ═══════════════════════════════════════════
// auth.js — Autenticación y seguridad
// ═══════════════════════════════════════════
import { q1, run, saveDB } from './db.js';
import { audit } from './auditoria.js';
import { showAlert, el, sv, hide, show } from './ui.js';

const SESSION_KEY = 'gdti_session';
const MAX_INTENTOS = 5;
const BLOQUEO_MIN  = 15;

export let CU = null; // current user

// ─── Hash SHA-256 ───
export async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─── Login ───
export async function doLogin() {
  const username = el('l-user').value.trim();
  const password = el('l-pass').value.trim();
  hide('login-err');

  if (!username || !password) {
    showLoginError('Ingresa tu usuario y contraseña');
    return;
  }

  // Login directo contra Supabase para garantizar datos frescos
  const { getSB } = await import('./db.js');
  const sb = getSB();
  const { data: usuarios, error } = await sb
    .from('usuarios')
    .select('*')
    .eq('username', username)
    .eq('activo', true)
    .limit(1);

  const user = usuarios?.[0] || null;

  if (error || !user) {
    showLoginError('Usuario o contraseña incorrectos');
    return;
  }

  // Verificar bloqueo
  if (user.bloqueado_hasta) {
    const bloqueadoHasta = new Date(user.bloqueado_hasta);
    if (new Date() < bloqueadoHasta) {
      const minRestantes = Math.ceil((bloqueadoHasta - new Date()) / 60000);
      showLoginError(`Cuenta bloqueada. Intenta en ${minRestantes} minuto${minRestantes !== 1 ? 's' : ''}.`);
      return;
    } else {
      await sb.from('usuarios').update({ intentos: 0, bloqueado_hasta: null }).eq('id', user.id);
    }
  }

  const hashInput = await sha256(password);
  if (hashInput !== user.password) {
    const nuevosIntentos = (user.intentos || 0) + 1;
    if (nuevosIntentos >= MAX_INTENTOS) {
      const bloqueadoHasta = new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString();
      await sb.from('usuarios').update({ intentos: nuevosIntentos, bloqueado_hasta: bloqueadoHasta }).eq('id', user.id);
      showLoginError(`Demasiados intentos fallidos. Cuenta bloqueada por ${BLOQUEO_MIN} minutos.`);
    } else {
      await sb.from('usuarios').update({ intentos: nuevosIntentos }).eq('id', user.id);
      const restantes = MAX_INTENTOS - nuevosIntentos;
      showLoginError(`Usuario o contraseña incorrectos. ${restantes} intento${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''}.`);
    }
    return;
  }

  // Login exitoso — resetear intentos
  await sb.from('usuarios').update({ intentos: 0, bloqueado_hasta: null }).eq('id', user.id);
  CU = user;
  guardarSesion(user);
  audit('LOGIN', 'Inicio de sesión exitoso', 'usuarios', user.id, '');
  import('./app.js').then(m => m.iniciarApp());
}

function showLoginError(msg) {
  const err = el('login-err');
  if (err) { err.textContent = msg; err.style.display = 'block'; }
}

// ─── Sesión persistente ───
function guardarSesion(user) {
  // Guardamos solo datos no sensibles en sessionStorage
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id, nombre: user.nombre, username: user.username,
    rol: user.rol, area: user.area
  }));
}

export function restaurarSesion() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const sesion = JSON.parse(raw);
    // Verificar que el usuario siga activo en BD
    const user = q1(`SELECT * FROM usuarios WHERE id=? AND activo=1`, [sesion.id]);
    if (!user) { cerrarSesion(); return null; }
    CU = user;
    return user;
  } catch(e) { return null; }
}

export function doLogout() {
  if (CU) audit('LOGOUT', 'Cierre de sesión', 'usuarios', CU.id, '');
  cerrarSesion();
  CU = null;
  el('app').style.display = 'none';
  el('login-screen').style.display = 'flex';
  sv('l-user', ''); sv('l-pass', '');
  el('login-err')?.style && (el('login-err').style.display = 'none');
}

function cerrarSesion() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Cambiar contraseña (para migrar a hash) ───
export async function hashearContrasenasExistentes() {
  // Solo se ejecuta una vez si las contraseñas están en texto plano
  const usuarios = q1(`SELECT password FROM usuarios WHERE username='admin'`);
  if (!usuarios) return;
  // Si ya tiene 64 chars es SHA-256, no hacer nada
  if (usuarios.password?.length === 64) return;
  // Hashear todas
  const todos = q(`SELECT id, password FROM usuarios`);
  for (const u of todos) {
    if (u.password.length < 64) {
      const hash = await sha256(u.password);
      run(`UPDATE usuarios SET password=? WHERE id=?`, [hash, u.id]);
    }
  }
}

// ─── Guard de permisos ───
export function requireRole(...roles) {
  if (!CU || !roles.includes(CU.rol)) {
    console.warn('[AUTH] Acceso denegado. Rol requerido:', roles);
    return false;
  }
  return true;
}

export function canEdit() { return CU && CU.rol !== 'visualizador'; }
export function isAdmin() { return CU && CU.rol === 'admin'; }
