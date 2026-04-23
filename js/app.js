// ═══════════════════════════════════════════
// app.js — Arranque, navegación, permisos
// ═══════════════════════════════════════════
import { initDB, suscribirRealtime, reloadCache } from './db.js';
import { restaurarSesion, doLogout, hashearContrasenasExistentes } from './auth.js';
import { setCUState }         from './state.js';
import { el, sv, showB, toggleSidebar,
         closeSidebarMobile, closeSidebar, esc } from './ui.js';
import { loadDash }            from './dashboard.js';
import { initNuevo }           from './expedientes.js';
import { buscar }              from './buscar.js';
import { loadUsuarios, loadCatalogo } from './catalogos.js';
import { loadAuditoria }       from './auditoria.js';

export let CU = null;

// ─── Indicador de conexión ────────────────
function setConexion(on) {
  const dot  = el('conn-dot');
  const txt  = el('conn-txt');
  if (dot) dot.className = 'conn-dot' + (on ? '' : ' off');
  if (txt) txt.textContent = on ? 'Conectado' : 'Sin conexión';
}

// ═══════════════════════════════════════════
// ARRANQUE
// ═══════════════════════════════════════════
export async function boot() {
  try {
    el('loading-msg').textContent = 'Conectando con la base de datos...';
    await initDB();
    await hashearContrasenasExistentes();

    // Suscribir a cambios en tiempo real
    suscribirRealtime(async (tabla) => {
      setConexion(true);
      // Refrescar la pantalla activa cuando llegue un cambio externo
      const pgActiva = document.querySelector('.pg.on')?.id;
      if (pgActiva === 'pg-dash')   loadDash();
      if (pgActiva === 'pg-buscar') buscar();
    });

    setConexion(true);

    const sesion = restaurarSesion();
    if (sesion) {
      CU = sesion;
      setCUState(sesion);
      el('loading').style.display = 'none';
      iniciarApp();
    } else {
      el('loading').style.display = 'none';
      el('login-screen').style.display = 'flex';
    }
  } catch(e) {
    el('loading').innerHTML = `
      <p style="color:rgba(255,255,255,.8);text-align:center;padding:20px">
        Error al iniciar:<br><small style="opacity:.7">${esc(e.message)}</small>
      </p>`;
    setConexion(false);
  }
}

export function iniciarApp() {
  import('./auth.js').then(m => {
    CU = m.CU;
    setCUState(m.CU);
    _setupUI(m.CU);
    const inicio = m.CU.rol === 'visualizador' ? 'buscar' : 'dash';
    goPg(inicio);
  });
}

function _setupUI(user) {
  el('app').style.display  = 'flex';
  el('login-screen').style.display = 'none';
  el('tb-av').textContent  = user.nombre[0].toUpperCase();
  el('tb-name').textContent = user.nombre;
  el('tb-role').textContent = user.rol;
  const isAdmin = user.rol === 'admin';
  const canEdit = user.rol !== 'visualizador';
  showB('nv-nuevo',      canEdit);
  showB('nav-admin-lbl', isAdmin);
  showB('nv-usuarios',   isAdmin);
  showB('nv-catalogo',   isAdmin);
  showB('nv-auditoria',  isAdmin);
  if (window.innerWidth < 900) closeSidebar();
}

// ─── Navegación ──────────────────────────
const PAGE_LOADERS = {
  dash:      loadDash,
  nuevo:     initNuevo,
  buscar:    buscar,
  usuarios:  loadUsuarios,
  catalogo:  loadCatalogo,
  auditoria: loadAuditoria,
};

export function goPg(id) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.nv').forEach(n => n.classList.remove('on'));
  el('pg-' + id)?.classList.add('on');
  el('nv-' + id)?.classList.add('on');
  PAGE_LOADERS[id]?.();
}

// ─── Globales para onclick en HTML ───────
window.goPg               = goPg;
window.doLogout           = doLogout;
window.toggleSidebar      = toggleSidebar;
window.closeSidebar       = closeSidebar;
window.closeSidebarMobile = closeSidebarMobile;
