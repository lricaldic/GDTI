// ═══════════════════════════════════════════
// auditoria.js — Registro de cambios
// ═══════════════════════════════════════════
import { run, q } from './db.js';
import { el, esc, fmtDT, showB, v } from './ui.js';

// Importación diferida para evitar circular
import { getCU } from './state.js';

/**
 * Registra una acción en la auditoría.
 * @param {string} accion       - LOGIN | NUEVO EXPEDIENTE | EDICIÓN | MOVIMIENTO | CAMBIO ESTADO | LOGOUT
 * @param {string} detalle      - Descripción del cambio
 * @param {string} tabla        - Tabla afectada
 * @param {any}    registroId   - ID del registro
 * @param {string} codGDTI      - Código del expediente relacionado
 * @param {string} valorAnterior - Valor antes del cambio (para ediciones)
 */
export function audit(accion, detalle = '', tabla = '', registroId = '', codGDTI = '', valorAnterior = '') {
  const _CU = getCU(); if (!_CU) return;
  run(`INSERT INTO auditoria(usuario,rol,accion,tabla,registro_id,expediente_codigo,detalle,valor_anterior)
       VALUES(?,?,?,?,?,?,?,?)`,
    [_CU.username, _CU.rol, accion, tabla || null, String(registroId) || null,
     codGDTI || null, detalle || null, valorAnterior || null]);
}

export function loadAuditoria() {
  const fUser  = v('aud-user').trim().toLowerCase();
  const fAcc   = v('aud-accion');
  const fCod   = v('aud-codigo').trim().toLowerCase();
  let rows = q(`SELECT * FROM auditoria ORDER BY id DESC LIMIT 500`);
  if (fUser) rows = rows.filter(r => (r.usuario || '').toLowerCase().includes(fUser));
  if (fAcc)  rows = rows.filter(r => r.accion === fAcc);
  if (fCod)  rows = rows.filter(r => (r.expediente_codigo || '').toLowerCase().includes(fCod));

  if (!rows.length) {
    el('tabla-auditoria').innerHTML = `<div class="empty"><p>Sin registros de auditoría</p></div>`;
    return;
  }
  el('tabla-auditoria').innerHTML = `<div class="tbl-wrap"><table>
    <thead><tr><th>Fecha y Hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Expediente</th><th>Detalle</th><th>Valor anterior</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td style="white-space:nowrap;font-size:.8rem">${fmtDT(r.fecha_hora)}</td>
      <td><span class="code">${esc(r.usuario)}</span></td>
      <td style="font-size:.75rem;color:var(--text3)">${esc(r.rol || '—')}</td>
      <td><span class="bdg" style="background:rgba(27,45,69,.08);color:var(--navy)">${esc(r.accion)}</span></td>
      <td>${r.expediente_codigo ? `<span class="code">${esc(r.expediente_codigo)}</span>` : '—'}</td>
      <td style="font-size:.82rem;color:var(--text2);max-width:220px">${esc(r.detalle) || '—'}</td>
      <td style="font-size:.78rem;color:var(--text3);max-width:160px">${esc(r.valor_anterior) || '—'}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
