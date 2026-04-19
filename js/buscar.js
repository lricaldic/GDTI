// ═══════════════════════════════════════════
// buscar.js — Búsqueda, consulta y movimientos en lista
// ═══════════════════════════════════════════
import { q, q1 }                                        from './db.js';
import { el, v, sv, esc, bdgEstado, fmtDate,
         origenLabel, tagMov, abrir, cerrar, showB }    from './ui.js';
import { getCU }                                         from './state.js';

// ─── Búsqueda principal ───────────────────
export async function buscar() {
  const fGdti = v('f-gdti').trim().toLowerCase();
  const fCod  = v('f-cod').trim().toLowerCase();
  const fFd   = v('f-fdesde');
  const fFh   = v('f-fhasta');
  const fAnio = v('f-anio');
  const fOri  = v('f-origen');
  const fEst  = v('f-estado');
  const fAsu  = v('f-asunto').trim().toLowerCase();
  const fCab  = v('f-cabecera').trim().toLowerCase();

  const dbMod = await import('./db.js');

  let rows = q(`SELECT * FROM expedientes ORDER BY id DESC`);

  if (fGdti) rows = rows.filter(r => r.codigo.toLowerCase().includes(fGdti));
  if (fCod)  rows = rows.filter(r => (r.codigo_origen || '').toLowerCase().includes(fCod));
  if (fFd)   rows = rows.filter(r => r.fecha_ingreso >= fFd);
  if (fFh)   rows = rows.filter(r => r.fecha_ingreso <= fFh);
  if (fAnio) rows = rows.filter(r => String(r.anio) === fAnio);
  if (fOri)  rows = rows.filter(r => r.origen === fOri);
  if (fEst)  rows = rows.filter(r => r.estado === fEst);
  if (fAsu)  rows = rows.filter(r => r.asunto.toLowerCase().includes(fAsu));
  if (fCab)  rows = rows.filter(r => (r.cabecera || '').toLowerCase().includes(fCab));

  el('b-count').textContent =
    `${rows.length} expediente${rows.length !== 1 ? 's' : ''} encontrado${rows.length !== 1 ? 's' : ''}`;

  if (!rows.length) {
    el('tabla-resultados').innerHTML =
      `<div class="empty"><p>Sin resultados con los filtros aplicados</p></div>`;
    return;
  }

  const canEdit = getCU()?.rol !== 'visualizador';
  const isAdmin = getCU()?.rol === 'admin';
  const areasCat = dbMod._areas;

  // Para cada expediente, obtener sus movimientos del cache
  const todosMovs = q(`SELECT * FROM movimientos ORDER BY fecha, id`);

  el('tabla-resultados').innerHTML = rows.map(r => {
    const movs = todosMovs
      .filter(m => m.expediente_id == r.id)
      .map(m => ({
        ...m,
        a_sig: areasCat.find(a => a.id == m.area_id)?.sigla  || null,
        a_nom: areasCat.find(a => a.id == m.area_id)?.nombre || null,
      }));

    const movHtml = movs.length
      ? `<div style="padding:0 14px 12px">
          <div style="font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;
            letter-spacing:.08em;padding:8px 0 6px;border-top:1px solid var(--border)">
            Movimientos (${movs.length})
          </div>
          <div class="tbl-wrap"><table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th></tr></thead>
            <tbody>${movs.map(m => `<tr>
              <td style="white-space:nowrap;font-size:.78rem">${fmtDate(m.fecha)}</td>
              <td>${tagMov(m.tipo)}</td>
              <td style="font-size:.8rem;max-width:300px">
                ${m.cabecera  ? `<div><span class="code" style="font-size:.75rem">${esc(m.cabecera)}</span></div>` : ''}
                ${m.a_sig     ? `<div style="color:var(--text2)">[${esc(m.a_sig)}] ${esc(m.a_nom)}</div>` : ''}
                ${m.area_libre ? `<div style="color:var(--text2)">${esc(m.area_libre)}</div>` : ''}
                ${m.responsable ? `<div style="color:var(--text2)">→ ${esc(m.responsable)}</div>` : ''}
                ${m.observaciones ? `<div style="color:var(--text3);font-size:.75rem">${esc(m.observaciones.substring(0,80))}${m.observaciones.length>80?'...':''}</div>` : ''}
              </td>
            </tr>`).join('')}</tbody>
          </table></div>
          ${canEdit ? `<div style="padding-top:8px">
            <button class="btn btn-gold btn-xs"
              onclick="window.abrirMov(${r.id},'${esc(r.codigo)}','${esc(r.fecha_ingreso)}')">
              + Agregar movimiento
            </button>
          </div>` : ''}
        </div>`
      : canEdit
        ? `<div style="padding:8px 14px 12px;border-top:1px solid var(--border)">
            <button class="btn btn-gold btn-xs"
              onclick="window.abrirMov(${r.id},'${esc(r.codigo)}','${esc(r.fecha_ingreso)}')">
              + Agregar primer movimiento
            </button>
          </div>`
        : '';

    return `
      <div style="border-bottom:2px solid var(--border2);margin-bottom:0">
        <div style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:0;align-items:stretch">
          <!-- CÓDIGO + ESTADO -->
          <div style="padding:12px 14px;border-right:1px solid var(--border);min-width:110px;display:flex;flex-direction:column;justify-content:center;gap:4px">
            <span class="code" style="font-size:.85rem">${esc(r.codigo)}</span>
            ${bdgEstado(r.estado)}
          </div>
          <!-- DATOS PRINCIPALES -->
          <div style="padding:12px 14px;min-width:0">
            <div style="font-size:.75rem;color:var(--text3);margin-bottom:2px">
              ${origenLabel(r.origen, r.origen_desc, r.gm_adjuntas)}
              ${r.codigo_origen ? ` · N°${esc(r.codigo_origen)}` : ''}
              · ${fmtDate(r.fecha_ingreso)}
            </div>
            ${r.cabecera ? `<div style="font-size:.8rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.cabecera)}</div>` : ''}
            <div style="font-size:.875rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(r.asunto)}">${esc(r.asunto)}</div>
          </div>
          <!-- ACCIONES -->
          <div style="padding:12px 14px;display:flex;align-items:center;gap:4px;flex-shrink:0">
            <button class="icon-btn" title="Ver historial completo"
              onclick="window.verDetalle(${r.id},'${esc(r.codigo)}')">👁</button>
            ${canEdit ? `
              <button class="icon-btn" title="Cambiar estado"
                onclick="window.abrirEstado(${r.id},'${esc(r.estado)}')">🔄</button>
            ` : ''}
            ${isAdmin ? `
              <button class="icon-btn" title="Editar datos"
                onclick="window.abrirEditar(${r.id})">✏️</button>
              <button class="icon-btn" title="Eliminar expediente"
                onclick="window.eliminarExpediente(${r.id},'${esc(r.codigo)}')"
                style="color:var(--red)">🗑️</button>
            ` : ''}
            <button class="icon-btn" title="Imprimir historial"
              onclick="window.imprimirExpediente(${r.id},'${esc(r.codigo)}')">🖨️</button>
          </div>
        </div>
        ${movHtml}
      </div>`;
  }).join('');
}

export function limpiarFiltros() {
  ['f-gdti','f-cod','f-fdesde','f-fhasta','f-asunto','f-cabecera']
    .forEach(id => sv(id, ''));
  sv('f-anio', ''); sv('f-origen', ''); sv('f-estado', '');
  buscar();
}

// ─── Detalle del expediente (modal) ──────
export function verDetalle(id, codigo) {
  el('det-titulo').textContent = `Expediente ${codigo}`;
  el('det-content').innerHTML  = `<div class="empty"><p>Cargando...</p></div>`;
  abrir('ov-detalle');
  _loadDetalle(id, codigo);
}

async function _loadDetalle(id, codigo) {
  const dbMod    = await import('./db.js');
  const areasCat = dbMod._areas;
  const respsCat = dbMod._responsables;

  const eRaw = q1(`SELECT * FROM expedientes WHERE id = ?`, [id]);
  if (!eRaw) { el('det-content').innerHTML = '<p>Error al cargar</p>'; return; }
  const e = {
    ...eRaw,
    r_nombre: respsCat.find(r => r.id == eRaw.responsable_id)?.nombre || null
  };

  const movsRaw = q(`SELECT * FROM movimientos WHERE expediente_id = ? ORDER BY fecha, id`, [id]);
  const movs = movsRaw.map(m => ({
    ...m,
    a_sig: areasCat.find(a => a.id == m.area_id)?.sigla  || null,
    a_nom: areasCat.find(a => a.id == m.area_id)?.nombre || null,
  }));

  const vincsRaw = q(`SELECT * FROM vinculos WHERE exp_origen = ? OR exp_destino = ?`, [id, id]);
  const allExps  = q(`SELECT id, codigo FROM expedientes`);
  const vincs = vincsRaw.map(vn => ({
    ...vn,
    c1:  allExps.find(ex => ex.id == vn.exp_origen)?.codigo  || '',
    c2:  allExps.find(ex => ex.id == vn.exp_destino)?.codigo || '',
    id1: vn.exp_origen,
    id2: vn.exp_destino,
  }));

  const canEdit = getCU()?.rol !== 'visualizador';

  const adjs = [];
  if (e.adj_copia > 0) adjs.push(`${e.adj_copia} jgo(s). copia`);
  if (e.adj_orig  > 0) adjs.push(`${e.adj_orig} jgo(s). original`);
  if (e.adj_cd    > 0) adjs.push(`${e.adj_cd} CD`);
  if (e.adj_usb   > 0) adjs.push(`${e.adj_usb} USB`);

  const derivsMov     = movs.filter(m => m.tipo === 'DERIVACION' || m.tipo === 'DERIVACION_EXT');
  const movRespuestas = movs.filter(m => m.tipo === 'RESPUESTA');
  const derivRes = derivsMov.map(d => ({
    area: d.a_sig ? `[${d.a_sig}] ${d.a_nom}` : (d.area_libre || '—'),
    fecha: d.fecha,
    respondido: movRespuestas.some(r => r.id > d.id)
  }));

  el('det-content').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${bdgEstado(e.estado)}
      <span class="bdg" style="background:rgba(27,45,69,.07);color:var(--navy)">${origenLabel(e.origen, e.origen_desc, e.gm_adjuntas)}</span>
      ${e.codigo_origen ? `<span class="bdg" style="background:var(--bg2);color:var(--text2)">N°${esc(e.codigo_origen)}</span>` : ''}
      ${canEdit ? `
        <button class="btn btn-gold btn-xs"
          onclick="window.cerrarModal('ov-detalle');window.abrirMov(${e.id},'${esc(e.codigo)}','${esc(e.fecha_ingreso)}')">+ Movimiento</button>
        <button class="btn btn-ghost btn-xs"
          onclick="window.cerrarModal('ov-detalle');window.abrirEstado(${e.id},'${esc(e.estado)}')">Cambiar estado</button>
        <button class="btn btn-ghost btn-xs"
          onclick="window.cerrarModal('ov-detalle');window.imprimirExpediente(${e.id},'${esc(e.codigo)}')">🖨️ Imprimir</button>
      ` : ''}
    </div>

    <div class="dgrid" style="margin-bottom:14px">
      <div class="di"><div class="dl">Código GDTI</div>
        <div class="dv"><span class="code">${esc(e.codigo)}</span></div></div>
      <div class="di"><div class="dl">Fecha de ingreso</div>
        <div class="dv">${fmtDate(e.fecha_ingreso)}</div></div>
      <div class="di full"><div class="dl">Cabecera del documento</div>
        <div class="dv">${esc(e.cabecera) || '—'}</div></div>
      <div class="di full"><div class="dl">Asunto</div>
        <div class="dv">${esc(e.asunto)}</div></div>
      <div class="di"><div class="dl">Folios</div>
        <div class="dv">${esc(e.folios) || '—'}${adjs.length ? ` + ${adjs.join(', ')}` : ''}</div></div>
      <div class="di"><div class="dl">Responsable</div>
        <div class="dv">${esc(e.r_nombre) || '—'}${e.responsable_otros ? ` (${esc(e.responsable_otros)})` : ''}</div></div>
      ${e.observaciones ? `<div class="di full"><div class="dl">Observaciones</div>
        <div class="dv">${esc(e.observaciones)}</div></div>` : ''}
    </div>

    ${vincs.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
          Expedientes vinculados
        </div>
        ${vincs.map(vn => {
          const esOrigen = vn.exp_origen == id;
          const otroId   = esOrigen ? vn.id2  : vn.id1;
          const otroCod  = esOrigen ? vn.c2   : vn.c1;
          return `<span class="vinc-tag"
            onclick="window.cerrarModal('ov-detalle');window.verDetalle(${otroId},'${esc(otroCod)}')">
            <span class="code" style="font-size:.72rem">${esc(otroCod)}</span>
            <span style="font-size:.68rem;color:var(--text3)">${esc(vn.tipo)}${vn.nota ? ' — ' + esc(vn.nota) : ''}</span>
          </span>`;
        }).join('')}
      </div>` : ''}

    ${derivRes.length ? `
      <div class="deriv-panel">
        <div class="dp-title">Resumen de derivaciones (${derivRes.length})</div>
        ${derivRes.map(d => `
          <div class="deriv-row">
            <div style="font-size:.85rem;font-weight:600;color:var(--navy);flex:1">${esc(d.area)}</div>
            <div style="font-size:.75rem;color:var(--text3)">${fmtDate(d.fecha)}</div>
            <span class="${d.respondido ? 'ds-respondido' : 'ds-pendiente'}">${d.respondido ? 'Respondido' : 'Pendiente'}</span>
          </div>`).join('')}
      </div>` : ''}

    <div class="divider"></div>
    <div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">
      Historial completo (${movs.length} movimiento${movs.length !== 1 ? 's' : ''})
    </div>
    ${movs.length ? `
      <div>${movs.map((m, i) => {
        const hasNext = i < movs.length - 1;
        return `<div class="tl-item">
          <div style="display:flex;flex-direction:column;align-items:center">
            <div class="tl-dot ${m.tipo === 'RESPUESTA' ? 'resp' : ''}"></div>
            ${hasNext ? `<div class="tl-line" style="flex:1;min-height:16px"></div>` : ''}
          </div>
          <div style="flex:1;padding-bottom:${hasNext ? 8 : 0}px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:2px">
              ${tagMov(m.tipo)}
              <span class="tl-date">${fmtDate(m.fecha)}${m.usuario ? ' · ' + esc(m.usuario) : ''}</span>
            </div>
            ${m.a_sig      ? `<div class="tl-sub">Área: <strong>[${esc(m.a_sig)}] ${esc(m.a_nom)}</strong></div>` : ''}
            ${m.area_libre ? `<div class="tl-sub">Área: <strong>${esc(m.area_libre)}</strong></div>` : ''}
            ${m.cabecera   ? `<div class="tl-sub">Doc: <span class="code" style="font-size:.77rem">${esc(m.cabecera)}</span></div>` : ''}
            ${m.responsable ? `<div class="tl-sub">Responsable: ${esc(m.responsable)}</div>` : ''}
            ${m.medio      ? `<div class="tl-sub">Medio: ${esc(m.medio)}</div>` : ''}
            ${m.observaciones ? `<div class="tl-text">${esc(m.observaciones)}</div>` : ''}
          </div>
        </div>`;
      }).join('')}</div>`
    : `<div class="empty" style="padding:24px"><p>Sin movimientos registrados</p></div>`}
  `;
}

// ─── Eliminar expediente (solo admin) ────
export async function eliminarExpediente(id, codigo) {
  if (getCU()?.rol !== 'admin') { alert('Solo el administrador puede eliminar expedientes'); return; }
  if (!confirm(`¿Eliminar el expediente ${codigo}?\n\nEsta acción no se puede deshacer.`)) return;
  const { getSB, reloadCache } = await import('./db.js');
  const { audit } = await import('./auditoria.js');
  const { error } = await getSB().from('expedientes').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  audit('ELIMINACIÓN', `Expediente eliminado: ${codigo}`, 'expedientes', id, codigo);
  await reloadCache();
  buscar();
}

window.eliminarExpediente = eliminarExpediente;
window.verDetalle         = verDetalle;
