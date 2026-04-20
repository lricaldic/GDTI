// ═══════════════════════════════════════════
// buscar.js — Lista unificada expedientes+movimientos
// ═══════════════════════════════════════════
import { q, q1 }                                     from './db.js';
import { el, v, sv, esc, bdgEstado, fmtDate,
         origenLabel, tagMov, abrir, showB }          from './ui.js';
import { getCU }                                      from './state.js';

// ─── Etiquetas legibles para tipos de movimiento ──
const MOV_LABEL = {
  RESPUESTA:     'Documento recibido',
  INFORME:       'Emisión de documento GDTI',
  DERIVACION:    'Derivación interna',
  DERIVACION_EXT:'Derivación externa',
  REVISION:      'Revisión interna',
  OBS:           'Observación / Nota interna',
};

// ═══════════════════════════════════════════
// BÚSQUEDA PRINCIPAL — lista unificada
// ═══════════════════════════════════════════
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

  const dbMod    = await import('./db.js');
  const areasCat = dbMod._areas;

  // ── Expedientes del cache ──────────────────
  let exps = q(`SELECT * FROM expedientes ORDER BY id DESC`);
  if (fGdti) exps = exps.filter(r => r.codigo.toLowerCase().includes(fGdti));
  if (fCod)  exps = exps.filter(r => (r.codigo_origen||'').toLowerCase().includes(fCod));
  if (fFd)   exps = exps.filter(r => r.fecha_ingreso >= fFd);
  if (fFh)   exps = exps.filter(r => r.fecha_ingreso <= fFh);
  if (fAnio) exps = exps.filter(r => String(r.anio) === fAnio);
  if (fOri)  exps = exps.filter(r => r.origen === fOri);
  if (fEst)  exps = exps.filter(r => r.estado === fEst);
  if (fAsu)  exps = exps.filter(r => r.asunto.toLowerCase().includes(fAsu));
  if (fCab)  exps = exps.filter(r => (r.cabecera||'').toLowerCase().includes(fCab));

  // Mapear expedientes a filas unificadas
  const filasExp = exps.map(r => ({
    _tipo:       'EXP',
    _fecha:      r.fecha_ingreso,
    _sort_id:    r.id * 10000,        // prioridad en mismo día
    id:          r.id,
    codigo:      r.codigo,
    fecha:       r.fecha_ingreso,
    origen:      origenLabel(r.origen, r.origen_desc, r.gm_adjuntas),
    codigo_origen: r.codigo_origen,
    folios:      r.folios,
    cabecera:    r.cabecera,
    asunto:      r.asunto,
    destinatario: null,
    observaciones: r.observaciones,
    estado:      r.estado,
    exp_id:      r.id,
    exp_fecha:   r.fecha_ingreso,
  }));

  // ── Movimientos del cache ──────────────────
  let movs = q(`SELECT * FROM movimientos ORDER BY id DESC`);
  // Heredar datos del expediente padre
  const allExps = q(`SELECT * FROM expedientes`);

  // Filtros aplicables a movimientos
  let filasMovs = [];
  if (!fOri && !fEst) { // origen y estado solo aplican a expedientes
    movs.forEach(m => {
      const exp = allExps.find(e => e.id == m.expediente_id);
      if (!exp) return;
      // Filtros que aplican a movimientos también
      if (fGdti && !exp.codigo.toLowerCase().includes(fGdti)) return;
      if (fAnio && String(exp.anio) !== fAnio) return;
      if (fFd   && m.fecha < fFd) return;
      if (fFh   && m.fecha > fFh) return;
      const areaMov = areasCat.find(a => a.id == m.area_id);
      const cabLow  = (m.cabecera||'').toLowerCase();
      const obsLow  = (m.observaciones||'').toLowerCase();
      if (fCab && !cabLow.includes(fCab)) return;
      if (fAsu && !obsLow.includes(fAsu) && !cabLow.includes(fAsu)) return;
      // No mostrar OBS simples de registro automático en la lista
      if (m.tipo === 'OBS' && (m.observaciones||'').startsWith('Expediente registrado')) return;

      filasMovs.push({
        _tipo:       'MOV',
        _fecha:      m.fecha,
        _sort_id:    exp.id * 10000 + m.id,
        id:          m.id,
        codigo:      exp.codigo,
        fecha:       m.fecha,
        origen:      origenLabel(exp.origen, exp.origen_desc, exp.gm_adjuntas),
        codigo_origen: null,
        folios:      null,
        cabecera:    m.cabecera,
        asunto:      m.observaciones || null,
        destinatario: areaMov ? `[${areaMov.sigla}] ${areaMov.nombre}` : (m.area_libre || m.responsable || null),
        observaciones: null,
        estado:      exp.estado,
        tipo_mov:    m.tipo,
        exp_id:      exp.id,
        exp_fecha:   exp.fecha_ingreso,
        mov_id:      m.id,
      });
    });
  }

  // ── Unificar y ordenar por fecha desc ──────
  const todas = [...filasExp, ...filasMovs].sort((a, b) => {
    if (b._fecha !== a._fecha) return b._fecha > a._fecha ? 1 : -1;
    return b._sort_id - a._sort_id;
  });

  el('b-count').textContent =
    `${todas.length} registro${todas.length !== 1 ? 's' : ''} encontrado${todas.length !== 1 ? 's' : ''}`;

  if (!todas.length) {
    el('tabla-resultados').innerHTML =
      `<div class="empty"><p>Sin resultados con los filtros aplicados</p></div>`;
    return;
  }

  const canEdit = getCU()?.rol !== 'visualizador';
  const isAdmin = getCU()?.rol === 'admin';

  el('tabla-resultados').innerHTML = `<div class="tbl-wrap"><table>
    <thead><tr>
      <th>Fecha</th><th>GDTI</th><th>Tipo</th>
      <th>Cabecera / Asunto</th><th>Procedencia</th>
      <th>Destinatario</th><th>Estado</th><th>Acciones</th>
    </tr></thead>
    <tbody>${todas.map(r => {
      const esExp = r._tipo === 'EXP';
      const tipoLabel = esExp
        ? `<span class="bdg" style="background:rgba(27,45,69,.09);color:var(--navy);font-size:.68rem">EXPEDIENTE</span>`
        : `${tagMov(r.tipo_mov)}`;

      const acciones = `<div style="display:flex;gap:3px;flex-wrap:nowrap">
        <button class="icon-btn" title="Ver historial"
          onclick="window.verHistorial(${r.exp_id},'${esc(r.codigo)}'${!esExp?','+r.mov_id:''})">👁</button>
        ${canEdit ? `<button class="icon-btn" title="Nuevo movimiento"
          onclick="window.abrirMov(${r.exp_id},'${esc(r.codigo)}','${esc(r.exp_fecha)}')">📋</button>
        <button class="icon-btn" title="Cambiar estado"
          onclick="window.abrirEstado(${r.exp_id},'${esc(r.estado)}')">🔄</button>` : ''}
        ${isAdmin ? `<button class="icon-btn" title="Editar"
          onclick="window.abrirEditar(${r.exp_id})">✏️</button>
        <button class="icon-btn" title="Eliminar" style="color:var(--red)"
          onclick="window.eliminarExpediente(${r.exp_id},'${esc(r.codigo)}')">🗑️</button>` : ''}
        <button class="icon-btn" title="Imprimir historial"
          onclick="window.imprimirExpediente(${r.exp_id},'${esc(r.codigo)}')">🖨️</button>
      </div>`;

      return `<tr style="${!esExp ? 'background:rgba(27,45,69,.015)' : ''}">
        <td style="white-space:nowrap;font-size:.82rem">${fmtDate(r.fecha)}</td>
        <td><span class="code" style="font-size:.78rem">${esc(r.codigo)}</span></td>
        <td>${tipoLabel}</td>
        <td style="max-width:200px">
          ${r.cabecera
            ? `<div style="font-size:.75rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px">${esc(r.cabecera)}</div>`
            : '<div style="font-size:.75rem;color:var(--text3)">——</div>'}
          ${r.asunto
            ? `<div style="font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px" title="${esc(r.asunto)}">${esc(r.asunto)}</div>`
            : '<div style="font-size:.82rem;color:var(--text3)">——</div>'}
        </td>
        <td style="font-size:.8rem;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${esc(r.origen) || '——'}
          ${r.codigo_origen ? `<br><span style="color:var(--text3);font-size:.72rem">N°${esc(r.codigo_origen)}</span>` : ''}
        </td>
        <td style="font-size:.8rem;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${esc(r.destinatario) || '——'}
        </td>
        <td>${bdgEstado(r.estado)}</td>
        <td>${acciones}</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

export function limpiarFiltros() {
  ['f-gdti','f-cod','f-fdesde','f-fhasta','f-asunto','f-cabecera']
    .forEach(id => sv(id, ''));
  sv('f-anio',''); sv('f-origen',''); sv('f-estado','');
  buscar();
}

// ═══════════════════════════════════════════
// VER HISTORIAL — modal con historial completo
// Si movId está definido, destaca ese movimiento
// ═══════════════════════════════════════════
export function verHistorial(expId, codigo, movId) {
  el('det-titulo').textContent = `Historial — Expediente ${codigo}`;
  el('det-content').innerHTML  = `<div class="empty"><p>Cargando...</p></div>`;
  abrir('ov-detalle');
  _loadHistorial(expId, codigo, movId);
}

async function _loadHistorial(expId, codigo, movId) {
  const dbMod    = await import('./db.js');
  const areasCat = dbMod._areas;
  const respsCat = dbMod._responsables;

  const eRaw = q1(`SELECT * FROM expedientes WHERE id = ?`, [expId]);
  if (!eRaw) { el('det-content').innerHTML = '<p>Error al cargar</p>'; return; }
  const e = {
    ...eRaw,
    r_nombre: respsCat.find(r => r.id == eRaw.responsable_id)?.nombre || null
  };

  const movsRaw = q(`SELECT * FROM movimientos WHERE expediente_id = ? ORDER BY fecha, id`, [expId]);
  const movs = movsRaw.map(m => ({
    ...m,
    a_sig: areasCat.find(a => a.id == m.area_id)?.sigla  || null,
    a_nom: areasCat.find(a => a.id == m.area_id)?.nombre || null,
  }));

  const vincsRaw = q(`SELECT * FROM vinculos WHERE exp_origen = ? OR exp_destino = ?`, [expId, expId]);
  const allExps  = q(`SELECT id, codigo FROM expedientes`);
  const vincs = vincsRaw.map(vn => ({
    ...vn,
    c1: allExps.find(ex => ex.id == vn.exp_origen)?.codigo  || '',
    c2: allExps.find(ex => ex.id == vn.exp_destino)?.codigo || '',
    id1: vn.exp_origen, id2: vn.exp_destino,
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
      <span class="bdg" style="background:rgba(27,45,69,.07);color:var(--navy)">${origenLabel(e.origen,e.origen_desc,e.gm_adjuntas)}</span>
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
      <div class="di full"><div class="dl">Cabecera</div>
        <div class="dv">${esc(e.cabecera)||'—'}</div></div>
      <div class="di full"><div class="dl">Asunto</div>
        <div class="dv">${esc(e.asunto)}</div></div>
      <div class="di"><div class="dl">Folios</div>
        <div class="dv">${e.folios||'—'}${adjs.length?` + ${adjs.join(', ')}`:''}</div></div>
      <div class="di"><div class="dl">Responsable</div>
        <div class="dv">${esc(e.r_nombre)||'—'}${e.responsable_otros?` (${esc(e.responsable_otros)})`:''}</div></div>
      ${e.observaciones?`<div class="di full"><div class="dl">Observaciones</div>
        <div class="dv">${esc(e.observaciones)}</div></div>`:''}
    </div>

    ${vincs.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Expedientes vinculados</div>
        ${vincs.map(vn => {
          const esO = vn.exp_origen == expId;
          return `<span class="vinc-tag"
            onclick="window.cerrarModal('ov-detalle');window.verHistorial(${esO?vn.id2:vn.id1},'${esc(esO?vn.c2:vn.c1)}')">
            <span class="code" style="font-size:.72rem">${esc(esO?vn.c2:vn.c1)}</span>
            <span style="font-size:.68rem;color:var(--text3)">${esc(vn.tipo)}${vn.nota?' — '+esc(vn.nota):''}</span>
          </span>`;
        }).join('')}
      </div>` : ''}

    ${derivRes.length ? `
      <div class="deriv-panel">
        <div class="dp-title">Derivaciones (${derivRes.length})</div>
        ${derivRes.map(d=>`
          <div class="deriv-row">
            <div style="font-size:.85rem;font-weight:600;color:var(--navy);flex:1">${esc(d.area)}</div>
            <div style="font-size:.75rem;color:var(--text3)">${fmtDate(d.fecha)}</div>
            <span class="${d.respondido?'ds-respondido':'ds-pendiente'}">${d.respondido?'Respondido':'Pendiente'}</span>
          </div>`).join('')}
      </div>` : ''}

    <div class="divider"></div>
    <div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">
      Historial completo (${movs.length} movimiento${movs.length!==1?'s':''})
    </div>
    ${movs.length ? `
      <div>${movs.map((m,i) => {
        const hasNext = i < movs.length - 1;
        // Destacar el movimiento seleccionado
        const destacado = movId && m.id == movId;
        return `<div class="tl-item" id="mov-${m.id}"
          style="${destacado?'background:rgba(184,134,42,.08);border-radius:8px;padding:6px 8px;margin:-6px -8px 4px;':''}">
          <div style="display:flex;flex-direction:column;align-items:center">
            <div class="tl-dot ${m.tipo==='RESPUESTA'?'resp':''}"></div>
            ${hasNext?`<div class="tl-line" style="flex:1;min-height:16px"></div>`:''}
          </div>
          <div style="flex:1;padding-bottom:${hasNext?8:0}px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:2px">
              ${tagMov(m.tipo)}
              ${destacado?`<span style="font-size:.7rem;background:var(--gold);color:#fff;padding:2px 7px;border-radius:10px;font-weight:700">← Este registro</span>`:''}
              <span class="tl-date">${fmtDate(m.fecha)}${m.usuario?' · '+esc(m.usuario):''}</span>
            </div>
            ${m.a_sig      ?`<div class="tl-sub">Área: <strong>[${esc(m.a_sig)}] ${esc(m.a_nom)}</strong></div>`:''}
            ${m.area_libre ?`<div class="tl-sub">Área: <strong>${esc(m.area_libre)}</strong></div>`:''}
            ${m.cabecera   ?`<div class="tl-sub">Doc: <span class="code" style="font-size:.77rem">${esc(m.cabecera)}</span></div>`:''}
            ${m.responsable?`<div class="tl-sub">Responsable: ${esc(m.responsable)}</div>`:''}
            ${m.medio      ?`<div class="tl-sub">Medio: ${esc(m.medio)}</div>`:''}
            ${m.observaciones?`<div class="tl-text">${esc(m.observaciones)}</div>`:''}
          </div>
        </div>`;
      }).join('')}</div>`
    :`<div class="empty" style="padding:24px"><p>Sin movimientos registrados</p></div>`}
  `;

  // Scroll al movimiento destacado
  if (movId) {
    setTimeout(() => {
      const el2 = document.getElementById(`mov-${movId}`);
      el2?.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 150);
  }
}

// ─── Eliminar expediente (solo admin) ────
export async function eliminarExpediente(id, codigo) {
  if (getCU()?.rol !== 'admin') { alert('Solo el administrador puede eliminar'); return; }
  if (!confirm(`¿Eliminar el expediente ${codigo} y todos sus movimientos?\n\nEsta acción no se puede deshacer.`)) return;
  const { getSB, reloadCache } = await import('./db.js');
  const { audit } = await import('./auditoria.js');
  const { error } = await getSB().from('expedientes').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  audit('ELIMINACIÓN', `Expediente eliminado: ${codigo}`, 'expedientes', id, codigo);
  await reloadCache();
  buscar();
}

window.verHistorial       = verHistorial;
window.eliminarExpediente = eliminarExpediente;
