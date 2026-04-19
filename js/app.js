// ═══════════════════════════════════════════
// app.js — Arranque, navegación, permisos
// ═══════════════════════════════════════════
import { initDB }              from './db.js';
import { restaurarSesion, doLogout, hashearContrasenasExistentes, CU as _CU } from './auth.js';
import { setCUState } from './state.js';
import { el, sv, show, hide, showB, toggleSidebar, closeSidebarMobile, openSidebar, closeSidebar, esc } from './ui.js';
import { loadDash }            from './dashboard.js';
import { initNuevo }           from './expedientes.js';
import { buscar }              from './buscar.js';
import { loadUsuarios, loadCatalogo } from './catalogos.js';
import { loadAuditoria }       from './auditoria.js';

// Re-export CU para módulos que lo necesiten
export let CU = null;

export async function boot() {
  try {
    el('loading-msg').textContent = 'Iniciando base de datos...';
    await initDB();
    await hashearContrasenasExistentes();

    // Intentar restaurar sesión activa
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
        Error al iniciar el sistema:<br><small style="opacity:.7">${esc(e.message)}</small>
      </p>`;
  }
}

export function iniciarApp() {
  // Actualizar referencia CU desde auth
  import('./auth.js').then(m => {
    CU = m.CU;
    setCUState(m.CU);
    _setupUI(m.CU);
    // Página inicial según rol
    const paginaInicio = m.CU.rol === 'visualizador' ? 'buscar' : 'dash';
    goPg(paginaInicio);
  });
}

function _setupUI(user) {
  el('app').style.display = 'flex';
  el('login-screen').style.display = 'none';
  el('tb-av').textContent   = user.nombre[0].toUpperCase();
  el('tb-name').textContent  = user.nombre;
  el('tb-role').textContent  = user.rol;

  const isAdmin  = user.rol === 'admin';
  const canEdit  = user.rol !== 'visualizador';
  showB('nv-nuevo',     canEdit);
  showB('nav-admin-lbl', isAdmin);
  showB('nv-usuarios',   isAdmin);
  showB('nv-catalogo',   isAdmin);
  showB('nv-auditoria',  isAdmin);

  // Sidebar en móvil empieza cerrado
  if (window.innerWidth < 900) closeSidebar();
}

// ─── Navegación ───
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

// ─── Exponer globales para onclick en HTML ───
// (necesario porque los módulos tienen scope privado)
window.goPg           = goPg;
window.doLogout       = doLogout;
window.toggleSidebar  = toggleSidebar;
window.closeSidebar   = closeSidebar;
window.closeSidebarMobile = closeSidebarMobile;
