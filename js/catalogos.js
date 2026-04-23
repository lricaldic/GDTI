// ═══════════════════════════════════════════
// catalogos.js — Usuarios, responsables, áreas
// ═══════════════════════════════════════════
import { q, q1, run, reloadCache, getAreas, getResponsables } from './db.js';
import { el, v, sv, showB, esc, showAlert, abrir, cerrar } from './ui.js';
import { sha256 } from './auth.js';
import { audit } from './auditoria.js';

// ═══════════════════════════════════════════
// USUARIOS
// ═══════════════════════════════════════════
export function loadUsuarios() {
  const rows = q(`SELECT * FROM usuarios ORDER BY id`);
  el('tabla-usuarios').innerHTML = `
    <div class="tbl-wrap"><table>
      <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Área</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(r.nombre)}</td>
        <td><span class="code">${esc(r.username)}</span></td>
        <td><span class="bdg" style="background:${r.rol==='admin'?'var(--navy)':r.rol==='editor'?'var(--gold)':'var(--bg2)'};color:${r.rol==='visualizador'?'var(--text2)':'#fff'}">${esc(r.rol)}</span></td>
        <td style="font-size:.82rem">${esc(r.area||'—')}</td>
        <td><span class="bdg" style="background:${r.activo?'#d1fae5':'#fee2e2'};color:${r.activo?'#065f46':'#991b1b'}">${r.activo?'Activo':'Inactivo'}</span></td>
        <td><div style="display:flex;gap:5px">
          <button class="icon-btn" onclick="window.abrirEditarUsuario(${r.id})">✏️</button>
          ${r.username !== 'admin' ? `<button class="icon-btn" onclick="window.toggleUser(${r.id},${r.activo})">${r.activo?'🔒':'🔓'}</button>` : ''}
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

export function abrirModalUsuario() {
  ['usu-id','usu-nombre','usu-user','usu-pass','usu-area'].forEach(id => sv(id,''));
  sv('usu-rol','editor');
  el('usu-titulo').textContent = 'Nuevo Usuario';
  abrir('ov-usuario');
}

export async function abrirEditarUsuario(id) {
  const r = q1(`SELECT * FROM usuarios WHERE id=?`, [id]);
  if (!r) return;
  sv('usu-id', r.id); sv('usu-nombre', r.nombre); sv('usu-user', r.username);
  sv('usu-pass',''); sv('usu-rol', r.rol); sv('usu-area', r.area||'');
  el('usu-titulo').textContent = 'Editar Usuario';
  abrir('ov-usuario');
}

export async function guardarUsuario() {
  const id = v('usu-id');
  const n  = v('usu-nombre').trim();
  const u  = v('usu-user').trim();
  const p  = v('usu-pass').trim();
  const r  = v('usu-rol');
  const a  = v('usu-area').trim();

  if (!n || !u) { alert('Nombre y usuario son obligatorios'); return; }

  if (id) {
    const anterior = q1(`SELECT username, rol FROM usuarios WHERE id=?`, [id]);
    if (p) {
      const hash = await sha256(p);
      run(`UPDATE usuarios SET nombre=?,username=?,password=?,rol=?,area=? WHERE id=?`, [n,u,hash,r,a,id]);
    } else {
      run(`UPDATE usuarios SET nombre=?,username=?,rol=?,area=? WHERE id=?`, [n,u,r,a,id]);
    }
    audit('EDICIÓN', `Usuario editado: ${n} / Rol: ${r}`, 'usuarios', id, '',
          `Anterior: ${anterior?.username} / ${anterior?.rol}`);
  } else {
    if (!p) { alert('La contraseña es obligatoria para usuarios nuevos'); return; }
    // Verificar username único
    if (q1(`SELECT id FROM usuarios WHERE username=?`, [u])) {
      alert('Ese nombre de usuario ya existe'); return;
    }
    const hash = await sha256(p);
    run(`INSERT INTO usuarios(nombre,username,password,rol,area) VALUES(?,?,?,?,?)`, [n,u,hash,r,a]);
    audit('NUEVO', `Usuario creado: ${n} / Rol: ${r}`, 'usuarios', lastIdFromDB(), '');
  }
  cerrar('ov-usuario');
  showAlert('al-usuarios','Usuario guardado correctamente');
  loadUsuarios();
}

export function toggleUser(id, activo) {
  run(`UPDATE usuarios SET activo=? WHERE id=?`, [activo ? 0 : 1, id]);
  audit(activo ? 'DESACTIVAR USUARIO' : 'ACTIVAR USUARIO',
        `Usuario ${activo?'desactivado':'activado'}`, 'usuarios', id, '');
  loadUsuarios();
}

function lastIdFromDB() {
  return q1(`SELECT last_insert_rowid() as id`)?.id;
}

// ═══════════════════════════════════════════
// CATÁLOGOS (responsables + áreas)
// ═══════════════════════════════════════════
export function loadCatalogo() {
  reloadCache();
  _renderResponsables();
  _renderAreas();
}

function _renderResponsables() {
  el('tabla-responsables').innerHTML = `
    <div class="tbl-wrap"><table>
      <thead><tr><th>Nombre</th><th>Cargo</th><th>Estado</th><th></th></tr></thead>
      <tbody>${getResponsables().map(r => `<tr>
        <td style="font-weight:600">${esc(r.nombre)}</td>
        <td style="font-size:.82rem;color:var(--text2)">${esc(r.cargo||'—')}</td>
        <td><span class="bdg" style="background:${r.activo?'#d1fae5':'#fee2e2'};color:${r.activo?'#065f46':'#991b1b'}">${r.activo?'Activo':'Inactivo'}</span></td>
        <td><div style="display:flex;gap:5px">
          <button class="icon-btn" onclick="window.abrirEditarResp(${r.id})">✏️</button>
          <button class="icon-btn" onclick="window.toggleResp(${r.id},${r.activo})">${r.activo?'🔒':'🔓'}</button>
        </div></td>
      </tr>`).join('')}
      </tbody>
    </table></div>`;
}

function _renderAreas() {
  const areas = q(`SELECT * FROM areas ORDER BY tipo,sigla`);
  el('tabla-areas').innerHTML = `
    <div class="tbl-wrap"><table>
      <thead><tr><th>Sigla</th><th>Nombre</th><th>Tipo</th><th></th></tr></thead>
      <tbody>${areas.map(r => `<tr>
        <td><span class="code">${esc(r.sigla||'—')}</span></td>
        <td style="font-size:.85rem">${esc(r.nombre)}</td>
        <td style="font-size:.75rem;color:var(--text2)">${esc(r.tipo)}</td>
        <td><div style="display:flex;gap:5px">
          <button class="icon-btn" onclick="window.abrirEditarArea(${r.id})">✏️</button>
          <button class="icon-btn" onclick="window.toggleArea(${r.id},${r.activa})">${r.activa?'🔒':'🔓'}</button>
        </div></td>
      </tr>`).join('')}
      </tbody>
    </table></div>`;
}

// ─── Responsables ─────────────────────────
export function abrirModalResp() {
  ['resp-id','resp-nombre','resp-cargo'].forEach(id => sv(id,''));
  el('resp-titulo').textContent = 'Nuevo Responsable';
  abrir('ov-resp');
}
export function abrirEditarResp(id) {
  const r = q1(`SELECT * FROM responsables WHERE id=?`, [id]);
  if (!r) return;
  sv('resp-id',r.id); sv('resp-nombre',r.nombre); sv('resp-cargo',r.cargo||'');
  el('resp-titulo').textContent = 'Editar Responsable';
  abrir('ov-resp');
}
export function guardarResp() {
  const id=v('resp-id'), n=v('resp-nombre').trim(), c=v('resp-cargo').trim();
  if (!n) { alert('Nombre obligatorio'); return; }
  if (id) run(`UPDATE responsables SET nombre=?,cargo=? WHERE id=?`, [n,c,id]);
  else    run(`INSERT INTO responsables(nombre,cargo) VALUES(?,?)`, [n,c]);
  cerrar('ov-resp');
  reloadCache();
  loadCatalogo();
}
export function toggleResp(id, a) {
  run(`UPDATE responsables SET activo=? WHERE id=?`, [a?0:1, id]);
  reloadCache(); loadCatalogo();
}

// ─── Áreas ────────────────────────────────
export function abrirModalArea() {
  ['area-id','area-nombre','area-sigla'].forEach(id => sv(id,''));
  sv('area-tipo','INTERNA');
  el('area-titulo').textContent = 'Nueva Área';
  abrir('ov-area');
}
export function abrirEditarArea(id) {
  const r = q1(`SELECT * FROM areas WHERE id=?`, [id]);
  if (!r) return;
  sv('area-id',r.id); sv('area-nombre',r.nombre); sv('area-sigla',r.sigla||''); sv('area-tipo',r.tipo);
  el('area-titulo').textContent = 'Editar Área';
  abrir('ov-area');
}
export function guardarArea() {
  const id=v('area-id'), n=v('area-nombre').trim(), s=v('area-sigla').trim().toUpperCase(), t=v('area-tipo');
  if (!n) { alert('Nombre obligatorio'); return; }
  if (id) run(`UPDATE areas SET nombre=?,sigla=?,tipo=? WHERE id=?`, [n,s,t,id]);
  else    run(`INSERT INTO areas(nombre,sigla,tipo) VALUES(?,?,?)`, [n,s,t]);
  cerrar('ov-area');
  reloadCache(); loadCatalogo();
}
export function toggleArea(id, a) {
  run(`UPDATE areas SET activa=? WHERE id=?`, [a?0:1, id]);
  reloadCache(); loadCatalogo();
}

// ─── Exponer al HTML ──────────────────────
window.abrirEditarUsuario = abrirEditarUsuario;
window.toggleUser         = toggleUser;
window.abrirEditarResp    = abrirEditarResp;
window.toggleResp         = toggleResp;
window.abrirEditarArea    = abrirEditarArea;
window.toggleArea         = toggleArea;
