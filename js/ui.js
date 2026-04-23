// ═══════════════════════════════════════════
// ui.js — Utilidades de interfaz y helpers
// ═══════════════════════════════════════════

// ─── DOM helpers ───
export const el  = id => document.getElementById(id);
export const v   = id => el(id)?.value ?? '';
export const sv  = (id, val) => { if (el(id)) el(id).value = val; };
export const show = id => { if (el(id)) el(id).style.display = ''; };
export const hide = id => { if (el(id)) el(id).style.display = 'none'; };
export const showB = (id, s) => { if (el(id)) el(id).style.display = s ? '' : 'none'; };

// ─── Sanitización XSS ───
// SIEMPRE usar esto antes de insertar texto externo en innerHTML
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Formateo ───
export const today   = () => new Date().toISOString().split('T')[0];
export const anio    = () => new Date().getFullYear();
export const fmtCod  = (nro, yr) => `${yr}-${String(nro).padStart(3,'0')}`;
export const fmtDate = s  => { if (!s) return '—'; return s.toString().split('T')[0]; };
export const fmtDT   = s  => { if (!s) return '—'; return s.replace('T',' ').substring(0,19); };

// ─── Badges y tags ───
const ESTADOS = {
  'EN TRÁMITE': 'bdg-tramite', 'RESPONDIDO': 'bdg-respondido',
  'ARCHIVADO': 'bdg-archivado', 'CERRADO': 'bdg-cerrado'
};
export const bdgEstado = e =>
  `<span class="bdg ${ESTADOS[e] || 'bdg-tramite'}">${esc(e) || '—'}</span>`;

const MOVS_LBL = {
  DERIVACION:'Derivación interna', DERIVACION_EXT:'Derivación externa',
  RESPUESTA:'Respuesta recibida', SALIDA:'Salida/Notificación',
  INFORME:'Informe emitido', REVISION:'Revisión interna', OBS:'Observación'
};
const MOVS_CLS = {
  DERIVACION:'tag-derivacion', DERIVACION_EXT:'tag-derivacion',
  RESPUESTA:'tag-respuesta', SALIDA:'tag-salida',
  INFORME:'tag-informe', REVISION:'tag-revision', OBS:'tag-obs'
};
export const tagMov = t =>
  `<span class="tag-mov ${MOVS_CLS[t] || 'tag-obs'}">${esc(MOVS_LBL[t] || t)}</span>`;

export function origenLabel(o, desc = '', adj = '') {
  const m = { MP:'Mesa de Partes', SGI:'SGI', SGDT:'SGDT', OGRD:'OGRD',
               ALC:'Alcaldía', GM:'Gerencia Municipal', OTRO:'Otro' };
  let lbl = m[o] || o;
  if (o === 'OTRO' && desc) lbl = desc;
  if (o === 'GM'   && adj)  lbl += ` (+${adj})`;
  return esc(lbl);
}

// ─── Alertas ─────────────────────────────
// showAlert con id: muestra alerta inline en el formulario (compatibilidad)
// showToast sin id: muestra notificación fija en la esquina inferior
export function showAlert(id, msg, tipo = 'ok', ms = 3500) {
  if (id) {
    // Alerta inline (dentro del formulario)
    const e = el(id);
    if (!e) { showToast(msg, tipo, ms); return; }
    e.textContent = msg;
    e.className   = `alert alert-${tipo}`;
    e.style.display = 'block';
    setTimeout(() => { e.style.display = 'none'; }, ms);
  } else {
    showToast(msg, tipo, ms);
  }
}

// Toast fijo abajo-derecha — para confirmaciones de guardado
export function showToast(msg, tipo = 'ok', ms = 3500) {
  // Reusar o crear el contenedor de toasts
  let container = el('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:9000;display:flex;flex-direction:column;gap:8px;max-width:340px';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText =
    `background:${tipo==='ok'?'#065f46':'#991b1b'};color:#fff;padding:12px 18px;border-radius:10px;`+
    `font-size:.875rem;font-weight:500;box-shadow:0 4px 18px rgba(0,0,0,.25);`+
    `animation:toastIn .25s ease;cursor:pointer;line-height:1.4`;
  toast.textContent = msg;
  toast.onclick = () => toast.remove();
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation='toastOut .3s ease forwards'; setTimeout(()=>toast.remove(),300); }, ms);
}

// ─── Modales ───
export const abrir  = id => el(id)?.classList.add('on');
export const cerrar = id => el(id)?.classList.remove('on');

// Cerrar modal al click fuera
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) e.target.classList.remove('on');
});

// ─── Navegación sidebar ───
let sidebarOpen = window.innerWidth >= 900;

export function toggleSidebar() {
  sidebarOpen ? closeSidebar() : openSidebar();
}
export function openSidebar() {
  sidebarOpen = true;
  el('sidebar')?.classList.remove('closed');
  el('hamburger')?.classList.add('open');
  if (window.innerWidth < 900) el('sidebar-overlay')?.classList.add('on');
}
export function closeSidebar() {
  sidebarOpen = false;
  el('sidebar')?.classList.add('closed');
  el('hamburger')?.classList.remove('open');
  el('sidebar-overlay')?.classList.remove('on');
}
export function closeSidebarMobile() {
  if (window.innerWidth < 900) closeSidebar();
}

window.addEventListener('resize', () => {
  if (window.innerWidth >= 900 && !sidebarOpen) openSidebar();
});

// ─── Fill selects con catálogos ───
import { getAreas, getResponsables } from './db.js';

export function fillResp(selId, addEmpty = true) {
  const sel = el(selId);
  if (!sel) return;
  let html = addEmpty ? `<option value="">— Seleccionar —</option>` : '';
  getResponsables().forEach(r =>
    html += `<option value="${r.id}">${esc(r.nombre)}${r.cargo ? ' – ' + esc(r.cargo) : ''}</option>`
  );
  sel.innerHTML = html;
}

export function fillAreaSelect(selId) {
  const sel = el(selId);
  if (!sel) return;
  let html = `<option value="">— Seleccionar —</option>`;
  let lastTipo = '';
  getAreas().forEach(a => {
    if (a.tipo !== lastTipo) {
      const labels = { INTERNA:'── Internas GDTI ──', MUNICIPAL:'── Municipales ──', EXTERNA:'── Externas ──' };
      html += `<option disabled>${labels[a.tipo] || a.tipo}</option>`;
      lastTipo = a.tipo;
    }
    html += `<option value="${a.id}">[${esc(a.sigla)}] ${esc(a.nombre)}</option>`;
  });
  sel.innerHTML = html;
}

export function onRespChange(selId, otrosWrapId) {
  const sel = el(selId);
  if (!sel) return;
  const nombre = sel.options[sel.selectedIndex]?.text?.toLowerCase() || '';
  showB(otrosWrapId, nombre.includes('otros'));
}

// ─── Constantes del dominio ───
export const SIGLAS_DERIV = ['SGI-OEP','SGI-OOP','SGI-OFI','SGDT','OGRD'];

export const ORIGENES_RECIBIDO = [
  { value:'SGI',     label:'SGI' },
  { value:'SGDT',    label:'SGDT – Catastro' },
  { value:'OGRD',    label:'OGRD – Defensa Civil' },
  { value:'SGI-OOP', label:'SGI-OOP – Obras Públicas' },
  { value:'SGI-OEP', label:'SGI-OEP – Estudios y Proyectos' },
  { value:'SGI-OFI', label:'SGI-OFI – Formulación de Inversiones' },
  { value:'ALC',     label:'Alcaldía' },
  { value:'GM',      label:'Gerencia Municipal' },
  { value:'OTRO',    label:'Otro (especificar)' },
];
