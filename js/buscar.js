// ═══════════════════════════════════════════
// buscar.js — Búsqueda y consulta de expedientes
// ═══════════════════════════════════════════
import { q, q1, qAsync, q1Async }                       from './db.js';
import { el, v, sv, esc, bdgEstado, fmtDate,
         origenLabel, tagMov, abrir, cerrar,
         showB, fillAreaSelect, fillResp, today }   from './ui.js';
import { getCU } from './state.js';
import { audit }                                     from './auditoria.js';

// ─── Búsqueda principal ───────────────────
export async function buscar() {
  const fGdti  = v('f-gdti').trim().toLowerCase();
  const fCod   = v('f-cod').trim().toLowerCase();
  const fFd    = v('f-fdesde');
  const fFh    = v('f-fhasta');
  const fAnio  = v('f-anio');
  const fOri   = v('f-origen');
  const fEst   = v('f-estado');
  const fAsu   = v('f-asunto').trim().toLowerCase();
  const fCab   = v('f-cabecera').trim().toLowerCase();

  // JOIN en memoria usando el cache — no necesita async
  const { _areas: areas, _responsables: resps } = await import('./db.js');
  let rows = q(`SELECT * FROM expedientes ORDER BY id DESC`);
  // Añadir nombre del responsable a cada fila
  rows = rows.map(r => ({
    ...r,
    r_nombre: resps.find(resp => resp.id == r.responsable_id)?.nombre || null
  }));

  if (fGdti)  rows = rows.filter(r => r.codigo.toLowerCase().includes(fGdti));
  if (fCod)   rows = rows.filter(r => (r.codigo_origen || '').toLowerCase().includes(fCod));
  if (fFd)    rows = rows.filter(r => r.fecha_ingreso >= fFd);
  if (fFh)    rows = rows.filter(r => r.fecha_ingreso <= fFh);
  if (fAnio)  rows = rows.filter(r => String(r.anio) === fAnio);
  if (fOri)   rows = rows.filter(r => r.origen === fOri);
  if (fEst)   rows = rows.filter(r => r.estado === fEst);
  if (fAsu)   rows = rows.filter(r => r.asunto.toLowerCase().includes(fAsu));
  if (fCab)   rows = rows.filter(r => (r.cabecera || '').toLowerCase().includes(fCab));

  el('b-count').textContent =
    `${rows.length} expediente${rows.length !== 1 ? 's' : ''} encontrado${rows.length !== 1 ? 's' : ''}`;

  if (!rows.length) {
    el('tabla-resultados').innerHTML =
      `<div class="empty"><p>Sin resultados con los filtros aplicados</p></div>`;
    return;
  }

  const canEdit = getCU()?.rol !== 'visualizador';

  el('tabla-resultados').innerHTML = `
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>GDTI</th><th>Origen</th><th>Fecha</th>
        <th>Cabecera / Asunto</th><th>Responsable</th><th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><span class="code">${esc(r.codigo)}</span></td>
        <td style="font-size:.78rem;white-space:nowrap">
          <strong>${origenLabel(r.origen, r.origen_desc, r.gm_adjuntas)}</strong>
          ${r.codigo_origen ? `<br><span style="color:var(--text3)">N°${esc(r.codigo_origen)}</span>` : ''}
        </td>
        <td style="white-space:nowrap;font-size:.82rem">${fmtDate(r.fecha_ingreso)}</td>
        <td style="max-width:210px">
          ${r.cabecera ? `<div style="font-size:.75rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${esc(r.cabecera)}</div>` : ''}
          <div title="${esc(r.asunto)}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${esc(r.asunto)}</div>
        </td>
        <td style="font-size:.8rem">
          ${esc(r.r_nombre || '—')}${r.responsable_otros ? ` <span style="color:var(--text3)">(${esc(r.responsable_otros)})</span>` : ''}
        </td>
        <td>${bdgEstado(r.estado)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" title="Ver historial" onclick="window.verDetalle(${r.id},'${esc(r.codigo)}')">👁</button>
            ${canEdit ? `
              <button class="icon-btn" title="Nuevo movimiento" onclick="window.abrirMov(${r.id},'${esc(r.codigo)}','${esc(r.fecha_ingreso)}')">📋</button>
              <button class="icon-btn" title="Editar datos" onclick="window.abrirEditar(${r.id})">✏️</button>
              <button class="icon-btn" title="Cambiar estado" onclick="window.abrirEstado(${r.id},'${esc(r.estado)}')">🔄</button>
            ` : ''}
            <button class="icon-btn" title="Imprimir historial" onclick="window.imprimirExpediente(${r.id},'${esc(r.codigo)}')">🖨️</button>
          </div>
        </td>
      </tr>`).join('')}
      </tbody>
    </table></div>`;
}

export function limpiarFiltros() {
  ['f-gdti','f-cod','f-fdesde','f-fhasta','f-asunto','f-cabecera']
    .forEach(id => sv(id, ''));
  sv('f-anio', ''); sv('f-origen', ''); sv('f-estado', '');
  buscar();
}

// ─── Detalle del expediente ───────────────
export function verDetalle(id, codigo) {
  el('det-titulo').textContent = `Expediente ${codigo}`;
  el('det-content').innerHTML  = `<div class="empty"><p>Cargando...</p></div>`;
  abrir('ov-detalle');
  _loadDetalle(id, codigo);
}

async function _loadDetalle(id, codigo) {
  const { _areas: areas, _responsables: resps } = await import('./db.js');

  // JOIN en memoria
  const eRaw = q1(`SELECT * FROM expedientes WHERE id = ?`, [id]);
  if (!eRaw) { el('det-content').innerHTML = '<p>Error al cargar</p>'; return; }
  const e = { ...eRaw, r_nombre: resps.find(r => r.id == eRaw.responsable_id)?.nombre || null };

  const movsRaw = q(`SELECT * FROM movimientos WHERE expediente_id = ? ORDER BY fecha, id`, [id]);
  const movs = movsRaw.map(m => ({
    ...m,
    a_sig: areas.find(a => a.id == m.area_id)?.sigla || null,
    a_nom: areas.find(a => a.id == m.area_id)?.nombre || null,
  }));

  const vincsRaw = q(`SELECT * FROM vinculos WHERE exp_origen = ? OR exp_destino = ?`, [id, id]);
  const { _cache } = await import('./db.js').catch(() => ({ _cache: {} }));
  // Obtener codigos de expedientes vinculados del cache
  const exps = q(`SELECT * FROM expedientes`);
  const vincs = vincsRaw.map(v => ({
    ...v,
    c1: exps.find(e => e.id == v.exp_origen)?.codigo  || '',
    c2: exps.find(e => e.id == v.exp_destino)?.codigo || '',
    id1: v.exp_origen,
    id2: v.exp_destino,
  }));

  const canEdit = getCU()?.rol !== 'visualizador';

  // Adjuntos
  const adjs = [];
  if (e.adj_copia > 0) adjs.push(`${e.adj_copia} jgo(s). copia`);
  if (e.adj_orig  > 0) adjs.push(`${e.adj_orig} jgo(s). original`);
  if (e.adj_cd    > 0) adjs.push(`${e.adj_cd} CD`);
  if (e.adj_usb   > 0) adjs.push(`${e.adj_usb} USB`);

  // Resumen de derivaciones
  const derivs = movs.filter(m => m.tipo === 'DERIVACION' || m.tipo === 'DERIVACION_EXT');
  const respsx  = movs.filter(m => m.tipo === 'RESPUESTA');
  const derivRes = derivs.map(d => ({
    area: d.a_sig ? `[${d.a_sig}] ${d.a_nom}` : (d.area_libre || '—'),
    fecha: d.fecha,
    respondido: respsx.some(r => r.id > d.id)
  }));

  el('det-content').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${bdgEstado(e.estado)}
      <span class="bdg" style="background:rgba(27,45,69,.07);color:var(--navy)">${origenLabel(e.origen, e.origen_desc, e.gm_adjuntas)}</span>
      ${e.codigo_origen ? `<span class="bdg" style="background:var(--bg2);color:var(--text2)">N°${esc(e.codigo_origen)}</span>` : ''}
      ${canEdit ? `
        <button class="btn btn-gold btn-xs" onclick="window.cerrarModal('ov-detalle');window.abrirMov(${e.id},'${esc(e.codigo)}','${esc(e.fecha_ingreso)}')">+ Movimiento</button>
        <button class="btn btn-ghost btn-xs" onclick="window.cerrarModal('ov-detalle');window.abrirEstado(${e.id},'${esc(e.estado)}')">Cambiar estado</button>
        <button class="btn btn-ghost btn-xs" onclick="window.cerrarModal('ov-detalle');window.imprimirExpediente(${e.id},'${esc(e.codigo)}')">🖨️ Imprimir</button>
      ` : ''}
    </div>

    <div class="dgrid" style="margin-bottom:14px">
      <div class="di"><div class="dl">Código GDTI</div><div class="dv"><span class="code">${esc(e.codigo)}</span></div></div>
      <div class="di"><div class="dl">Fecha de ingreso</div><div class="dv">${fmtDate(e.fecha_ingreso)}</div></div>
      <div class="di full"><div class="dl">Cabecera del documento</div><div class="dv">${esc(e.cabecera) || '—'}</div></div>
      <div class="di full"><div class="dl">Asunto</div><div class="dv">${esc(e.asunto)}</div></div>
      <div class="di"><div class="dl">Folios</div>
        <div class="dv">${esc(e.folios) || '—'}${adjs.length ? ` <span style="color:var(--text3);font-size:.8rem">+ ${adjs.join(', ')}</span>` : ''}</div>
      </div>
      <div class="di"><div class="dl">Responsable</div>
        <div class="dv">${esc(e.r_nombre) || '—'}${e.responsable_otros ? ` (${esc(e.responsable_otros)})` : ''}</div>
      </div>
      ${e.observaciones ? `<div class="di full"><div class="dl">Observaciones</div><div class="dv">${esc(e.observaciones)}</div></div>` : ''}
    </div>

    ${vincs.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Expedientes vinculados</div>
        ${vincs.map(v => {
          const esOrigen = v.exp_origen == id;
          const otroId   = esOrigen ? v.id2 : v.id1;
          const otroCod  = esOrigen ? v.c2  : v.c1;
          return `<span class="vinc-tag" onclick="window.cerrarModal('ov-detalle');window.verDetalle(${otroId},'${esc(otroCod)}')">
            <span class="code" style="font-size:.72rem">${esc(otroCod)}</span>
            <span style="font-size:.68rem;color:var(--text3)">${esc(v.tipo)}${v.nota ? ' — ' + esc(v.nota) : ''}</span>
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
            ${m.a_sig    ? `<div class="tl-sub">Área: <strong>[${esc(m.a_sig)}] ${esc(m.a_nom)}</strong></div>` : ''}
            ${m.area_libre ? `<div class="tl-sub">Área: <strong>${esc(m.area_libre)}</strong></div>` : ''}
            ${m.cabecera ? `<div class="tl-sub">Doc: <span class="code" style="font-size:.77rem">${esc(m.cabecera)}</span></div>` : ''}
            ${m.responsable ? `<div class="tl-sub">Responsable: ${esc(m.responsable)}</div>` : ''}
            ${m.medio    ? `<div class="tl-sub">Medio: ${esc(m.medio)}</div>` : ''}
            ${m.observaciones ? `<div class="tl-text">${esc(m.observaciones)}</div>` : ''}
          </div>
        </div>`;
      }).join('')}</div>`
    : `<div class="empty" style="padding:24px"><p>Sin movimientos registrados</p></div>`}
  `;
}
