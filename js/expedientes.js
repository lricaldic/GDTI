// ═══════════════════════════════════════════
// expedientes.js — Nuevo expediente, edición, estado
// ═══════════════════════════════════════════
import { q, q1, run, lastId, reloadCache, _areas, _responsables } from './db.js';
import { el, v, sv, show, hide, showB, esc,
         today, anio, fmtCod, fillResp, onRespChange,
         showAlert, abrir, cerrar, SIGLAS_DERIV }          from './ui.js';
import { getCU } from './state.js';
import { audit }                                            from './auditoria.js';
import { buscar }                                           from './buscar.js';
import { loadDash }                                         from './dashboard.js';

// ─── Contadores de filas dinámicas ───
let derivCounter = 0;

// ═══════════════════════════════════════════
// NUEVO EXPEDIENTE — renderiza el formulario
// ═══════════════════════════════════════════
export function initNuevo() {
  reloadCache();
  _renderFormNuevo();
  _resetFormNuevo();
}

function _renderFormNuevo() {
  el('form-nuevo').innerHTML = `
    <div class="sec-hdr">1. Identificación</div>
    <div class="fgrid">
      <div class="fg2">
        <label>Registro GDTI <span class="req">*</span></label>
        <div style="display:flex;gap:8px">
          <input id="n-gdti" placeholder="001" style="flex:1"
            oninput="this.value=this.value.replace(/[^0-9]/g,'');window._updGDTIprev()">
          <button class="btn btn-gold btn-sm" onclick="window._autoGDTI()">Auto</button>
        </div>
        <div class="hint" id="gdti-prev"></div>
      </div>
      <div class="fg2">
        <label>Fecha ingreso a GDTI <span class="req">*</span></label>
        <input type="date" id="n-fecha">
      </div>
    </div>

    <div class="divider"></div>
    <div class="sec-hdr">2. Origen del documento</div>
    <div class="fgrid">
      <div class="fg2">
        <label>Origen <span class="req">*</span></label>
        <select id="n-origen" onchange="window._updateOrigenUI()">
          <option value="MP">Mesa de Partes</option>
          <option value="SGI">SGI</option>
          <option value="SGDT">SGDT – Catastro</option>
          <option value="OGRD">OGRD – Defensa Civil</option>
          <option value="ALC">Alcaldía</option>
          <option value="GM">Gerencia Municipal</option>
          <option value="OTRO">Otro (especificar)</option>
        </select>
      </div>
      <div class="fg2" id="n-codwrap">
        <label id="n-codlbl">Código de registro MP <span class="req">*</span></label>
        <input id="n-codreg" placeholder="Ej: 3456" maxlength="5"
          oninput="this.value=this.value.replace(/[^0-9]/g,'')">
        <div class="hint">3 a 5 dígitos</div>
      </div>
      <div class="fg2 full" id="n-otro-wrap" style="display:none">
        <label>Descripción del origen <span class="req">*</span></label>
        <input id="n-otro-desc" placeholder="Ej: ORH, UGEL..."
          oninput="this.value=this.value.toUpperCase()">
      </div>
      <div class="fg2 full" id="n-gm-adj-wrap" style="display:none">
        <label>Áreas adjuntas (opcional)</label>
        <input id="n-gm-adj" placeholder="Ej: ORH, GDS"
          oninput="this.value=this.value.toUpperCase()">
        <div class="hint">Si GM adjunta informes de otras áreas. Separar con comas.</div>
      </div>
    </div>

    <div class="divider"></div>
    <div class="sec-hdr">3. Datos del documento</div>
    <div class="fgrid">
      <div class="fg2 full">
        <label>Cabecera del documento</label>
        <input id="n-cabecera" placeholder="Ej: OFICIO N°10-2026/GDTI  |  SOLICITUD SIN NÚMERO"
          oninput="this.value=this.value.toUpperCase()">
        <div class="hint">Tipo + número tal como aparece. Vacío si no tiene número.</div>
      </div>
      <div class="fg2 full">
        <label>Asunto <span class="req">*</span></label>
        <textarea id="n-asunto" placeholder="Descripción del asunto..."></textarea>
      </div>
      <div class="fg2">
        <label>Folios <span class="req">*</span></label>
        <input id="n-folios" type="number" min="1" placeholder="Nro. de folios">
      </div>
      <div class="fg2">
        <label style="display:block;font-size:.73rem;font-weight:600;color:var(--text2);margin-bottom:10px;letter-spacing:.05em;text-transform:uppercase">
          Adjuntos (0 = ninguno)
        </label>
        <div class="adj-row"><label>Juegos en copia</label><input type="number" class="adj-num" id="adj-copia" value="0" min="0" max="9"></div>
        <div class="adj-row"><label>Juegos en original</label><input type="number" class="adj-num" id="adj-orig" value="0" min="0" max="9"></div>
        <div class="adj-row"><label>CD</label><input type="number" class="adj-num" id="adj-cd" value="0" min="0" max="9"></div>
        <div class="adj-row"><label>USB</label><input type="number" class="adj-num" id="adj-usb" value="0" min="0" max="9"></div>
      </div>
    </div>

    <div class="divider"></div>
    <div class="sec-hdr" style="display:flex;justify-content:space-between;align-items:center">
      <span>4. Derivación <span class="req" id="deriv-req-lbl">*</span></span>
      <span id="deriv-arch-hint" style="display:none;font-size:.75rem;color:var(--text3);font-weight:400">No requerida cuando estado es ARCHIVADO</span>
    </div>
    <div class="fgrid" style="margin-bottom:14px">
      <div class="fg2">
        <label>Estado inicial</label>
        <select id="n-estado" onchange="window._updDerivOblig()">
          <option value="EN TRÁMITE">EN TRÁMITE</option>
          <option value="ARCHIVADO">ARCHIVADO (archivar sin derivar)</option>
        </select>
      </div>
    </div>
    <div id="deriv-body">
      <div style="display:flex;gap:20px;margin-bottom:14px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
          <input type="radio" name="deriv-tipo" id="rd-responsable" value="responsable" onchange="window._updDerivTipo()" checked>
          Responsable interno
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
          <input type="radio" name="deriv-tipo" id="rd-area" value="area" onchange="window._updDerivTipo()">
          Área interna
        </label>
      </div>
      <div id="panel-responsable" class="fgrid">
        <div class="fg2">
          <label>Responsable <span class="req">*</span></label>
          <select id="n-responsable" onchange="window._onRespChangeN()">
            <option value="">— Seleccionar —</option>
          </select>
        </div>
        <div class="fg2" id="n-resp-otros-wrap" style="display:none">
          <label>Especificar</label>
          <input id="n-resp-otros" oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="fg2">
          <label>Fecha de entrega <span class="req">*</span></label>
          <input type="date" id="n-fecha-resp">
          <div class="hint">Normalmente la misma fecha de ingreso.</div>
        </div>
      </div>
      <div id="panel-areas" style="display:none">
        <div id="n-derivaciones-list"></div>
        <button class="btn btn-gold btn-xs" style="margin-top:6px" onclick="window._addDerivRow()">+ Agregar área</button>
      </div>
    </div>

    <div class="divider"></div>
    <div style="padding:12px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border)">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
        <input type="checkbox" id="n-vincular-check" onchange="window._updNVincularUI()" style="width:16px;height:16px;cursor:pointer">
        Vincular con otro registro GDTI existente
      </label>
      <div id="n-vincular-panel" style="display:none;margin-top:12px">
        <div class="fgrid">
          <div class="fg2">
            <label>Código GDTI</label>
            <div style="display:flex;gap:8px">
              <input id="n-vinc-codigo" placeholder="Ej: 2026-045" style="flex:1"
                oninput="this.value=this.value.toUpperCase()">
              <button class="btn btn-gold btn-sm" onclick="window._buscarVinculo('n-vinc-codigo','n-vinc-res','n-vinc-id')">Buscar</button>
            </div>
            <div id="n-vinc-res" class="hint" style="margin-top:6px"></div>
            <input type="hidden" id="n-vinc-id">
          </div>
          <div class="fg2">
            <label>Tipo de vínculo</label>
            <select id="n-vinc-tipo">
              <option value="RELACIONADO">Relacionado</option>
              <option value="CONTINUACION">Continuación de ese registro</option>
              <option value="RESPUESTA_MULTIPLE">Respuesta múltiple (varios → uno)</option>
            </select>
          </div>
          <div class="fg2 full">
            <label>Nota explicativa</label>
            <input id="n-vinc-nota" placeholder="Ej: Continuación del GDTI-2026-045 por límite de cuaderno">
          </div>
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
      <button class="btn btn-ghost" onclick="window._limpiarNuevo()">Limpiar</button>
      <button class="btn btn-primary" id="btn-guardar" onclick="window.guardarExpediente()">Guardar Expediente</button>
    </div>
  `;

  fillResp('n-responsable');
  sv('n-fecha', today());
  sv('n-fecha-resp', today());
  _updGDTIprev();
  _updateOrigenUI();
  _updDerivOblig();
}

function _resetFormNuevo() {
  ['n-gdti','n-codreg','n-cabecera','n-asunto','n-folios',
   'n-otro-desc','n-gm-adj','n-resp-otros','n-vinc-codigo','n-vinc-nota']
    .forEach(id => sv(id, ''));
  sv('n-origen','MP'); sv('n-estado','EN TRÁMITE'); sv('n-responsable','');
  sv('n-vinc-tipo','RELACIONADO'); sv('n-vinc-id','');
  sv('n-fecha', today()); sv('n-fecha-resp', today());
  ['adj-copia','adj-orig','adj-cd','adj-usb'].forEach(id => {
    const e = el(id); if (e) e.value = '0';
  });
  if (el('n-derivaciones-list')) el('n-derivaciones-list').innerHTML = '';
  derivCounter = 0;
  const rd = el('rd-responsable'); if (rd) rd.checked = true;
  if (el('n-vincular-check')) el('n-vincular-check').checked = false;
  showB('n-vincular-panel', false); showB('n-resp-otros-wrap', false);
  _updDerivTipo(); _updDerivOblig(); _updateOrigenUI(); _updGDTIprev();
}

// ─── Helpers internos del formulario ─────
function _updateOrigenUI() {
  const o = v('n-origen');
  showB('n-codwrap',   ['MP','ALC'].includes(o));
  showB('n-otro-wrap', o === 'OTRO');
  showB('n-gm-adj-wrap', o === 'GM');
  const lbl = el('n-codlbl');
  if (lbl) {
    lbl.innerHTML = o === 'MP'
      ? 'Código de registro MP <span class="req">*</span>'
      : 'Código de registro Alcaldía <span class="req">*</span>';
  }
  sv('n-codreg', '');
}
function _updGDTIprev() {
  const nro = v('n-gdti'); const yr = anio();
  if (nro) {
    if (el('gdti-prev')) el('gdti-prev').textContent = `→ Código: ${fmtCod(parseInt(nro)||0, yr)}`;
  } else {
    const next = (q1(`SELECT MAX(nro) mx FROM expedientes WHERE anio=?`,[yr])?.mx || 0) + 1;
    if (el('gdti-prev')) el('gdti-prev').textContent = `Próximo disponible: ${fmtCod(next, yr)}`;
  }
}
function _autoGDTI() {
  const yr = anio();
  const next = (q1(`SELECT MAX(nro) mx FROM expedientes WHERE anio=?`,[yr])?.mx || 0) + 1;
  sv('n-gdti', String(next).padStart(3,'0'));
  _updGDTIprev();
}
function _updDerivTipo() {
  const tipo = document.querySelector('input[name="deriv-tipo"]:checked')?.value || 'responsable';
  showB('panel-responsable', tipo === 'responsable');
  showB('panel-areas',       tipo === 'area');
  if (tipo === 'area' && el('n-derivaciones-list') && !el('n-derivaciones-list').children.length) {
    _addDerivRow();
  }
}
function _updDerivOblig() {
  const arch = v('n-estado') === 'ARCHIVADO';
  showB('deriv-body',       !arch);
  showB('deriv-req-lbl',    !arch);
  showB('deriv-arch-hint',   arch);
}
function _onRespChangeN() {
  onRespChange('n-responsable', 'n-resp-otros-wrap');
}
function _updNVincularUI() {
  showB('n-vincular-panel', el('n-vincular-check')?.checked);
}
function _buscarVinculo(inputId, resultId, hiddenId) {
  const cod = v(inputId).trim().toUpperCase();
  if (!cod) { if(el(resultId)) el(resultId).textContent = 'Ingresa un código'; return; }
  const row = q1(`SELECT id, codigo, asunto FROM expedientes WHERE codigo LIKE ?`, [`%${cod}%`]);
  if (!row) {
    if(el(resultId)) el(resultId).textContent = 'No encontrado';
    sv(hiddenId, '');
    return;
  }
  sv(hiddenId, row.id);
  if (el(resultId)) el(resultId).innerHTML =
    `<span style="color:var(--green)">✓ ${esc(row.codigo)} — ${esc(row.asunto.substring(0,50))}</span>`;
}

// Filas de derivación a área
function _addDerivRow(areaId = '', fecha = '') {
  derivCounter++;
  const id = `drv-${derivCounter}`;
  const areas = _areas.filter(a => SIGLAS_DERIV.includes(a.sigla));
  let opts = `<option value="">— Área —</option>`;
  areas.forEach(a =>
    opts += `<option value="${a.id}" ${String(a.id)===String(areaId)?'selected':''}>[${esc(a.sigla)}] ${esc(a.nombre)}</option>`
  );
  opts += `<option value="OTRO">OTRO (especificar)</option>`;
  const div = document.createElement('div');
  div.className = 'deriv-item'; div.id = id;
  div.innerHTML = `
    <select style="flex:2" onchange="window._updDerivOtro('${id}')">${opts}</select>
    <input type="date" value="${fecha || today()}" style="flex:1;min-width:110px">
    <button class="deriv-remove" onclick="document.getElementById('${id}').remove()">×</button>
    <input type="text" id="${id}-otro" placeholder="Siglas del área" maxlength="20"
      oninput="this.value=this.value.toUpperCase()"
      style="display:none;flex:1 1 100%;margin-top:6px;padding:6px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:.82rem;background:#fff;outline:none">
  `;
  el('n-derivaciones-list').appendChild(div);
}
function _updDerivOtro(id) {
  const sel = el(id)?.querySelector('select');
  const inp = el(`${id}-otro`);
  if (inp) inp.style.display = sel?.value === 'OTRO' ? '' : 'none';
}
function _getDerivaciones() {
  const items = el('n-derivaciones-list').querySelectorAll('.deriv-item');
  const result = [];
  items.forEach(item => {
    const sel  = item.querySelector('select');
    const date = item.querySelector('input[type=date]');
    const libre = item.querySelector('input[type=text]');
    if (!sel?.value) return;
    if (sel.value === 'OTRO') {
      const txt = libre?.value?.trim().toUpperCase();
      if (txt) result.push({ areaId: null, areaLibre: txt, fecha: date?.value || today() });
    } else {
      result.push({ areaId: parseInt(sel.value), areaLibre: null, fecha: date?.value || today() });
    }
  });
  return result;
}

// ─── Exponer helpers internos al HTML ────
window._updateOrigenUI  = _updateOrigenUI;
window._updGDTIprev     = _updGDTIprev;
window._autoGDTI        = _autoGDTI;
window._updDerivTipo    = _updDerivTipo;
window._updDerivOblig   = _updDerivOblig;
window._onRespChangeN   = _onRespChangeN;
window._updNVincularUI  = _updNVincularUI;
window._buscarVinculo   = _buscarVinculo;
window._addDerivRow     = _addDerivRow;
window._updDerivOtro    = _updDerivOtro;
window._limpiarNuevo    = () => { _resetFormNuevo(); _autoGDTI(); };

// ═══════════════════════════════════════════
// GUARDAR EXPEDIENTE — validaciones completas
// ═══════════════════════════════════════════
export function guardarExpediente() {
  const yr      = anio();
  const nroStr  = v('n-gdti').trim();
  const origen  = v('n-origen');
  const codreg  = v('n-codreg').trim();
  const otroDesc = v('n-otro-desc').trim().toUpperCase();
  const gmAdj   = v('n-gm-adj').trim().toUpperCase();
  const fecha   = v('n-fecha');
  const cab     = v('n-cabecera').trim().toUpperCase();
  const asunto  = v('n-asunto').trim();
  const folios  = parseInt(v('n-folios')) || null;
  const estado  = v('n-estado');
  const adjCopia = parseInt(el('adj-copia')?.value) || 0;
  const adjOrig  = parseInt(el('adj-orig')?.value)  || 0;
  const adjCd    = parseInt(el('adj-cd')?.value)    || 0;
  const adjUsb   = parseInt(el('adj-usb')?.value)   || 0;
  const archivado = estado === 'ARCHIVADO';
  const tipoD = document.querySelector('input[name="deriv-tipo"]:checked')?.value || 'responsable';
  const respId     = (!archivado && tipoD==='responsable') ? v('n-responsable') || null : null;
  const respOtros  = (!archivado && tipoD==='responsable') ? v('n-resp-otros').trim().toUpperCase() || null : null;
  const fechaResp  = (!archivado && tipoD==='responsable') ? (v('n-fecha-resp') || fecha) : fecha;
  const derivs     = (!archivado && tipoD==='area') ? _getDerivaciones() : [];

  // ─── Validaciones ─────────────────────
  const err = (msg) => { showAlert('al-nuevo-err', msg, 'err'); return false; };
  if (!nroStr)                                         { err('El Registro GDTI es obligatorio'); return; }
  if (!fecha)                                          { err('La fecha de ingreso es obligatoria'); return; }
  if (!asunto)                                         { err('El asunto es obligatorio'); return; }
  if (!folios || folios <= 0)                          { err('Los folios son obligatorios y deben ser mayor a cero'); return; }
  if (['MP','ALC'].includes(origen) && !codreg)        { err('El código de registro de origen es obligatorio para MP o Alcaldía'); return; }
  if (origen === 'OTRO' && !otroDesc)                  { err('Describe el origen del documento'); return; }
  if (!archivado) {
    if (tipoD === 'responsable') {
      if (!respId) { err('Selecciona el responsable interno'); return; }
      if (fechaResp && fechaResp < fecha) { err('La fecha de entrega no puede ser anterior a la fecha de ingreso'); return; }
    }
    if (tipoD === 'area') {
      if (!derivs.length) { err('Agrega al menos un área de derivación'); return; }
      const filas = el('n-derivaciones-list').querySelectorAll('.deriv-item');
      for (const fila of filas) {
        const sel  = fila.querySelector('select');
        const txt  = fila.querySelector('input[type=text]');
        const dfec = fila.querySelector('input[type=date]');
        if (sel?.value === 'OTRO' && !txt?.value?.trim()) { err('El campo de siglas en "OTRO" es obligatorio'); return; }
        if (dfec?.value && dfec.value < fecha) { err('La fecha de derivación no puede ser anterior a la fecha de ingreso'); return; }
      }
    }
  }

  const nro    = parseInt(nroStr);
  const codigo = fmtCod(nro, yr);

  if (q1(`SELECT id FROM expedientes WHERE codigo=?`, [codigo])) {
    err(`El código ${codigo} ya existe. Usa "Auto".`); return;
  }

  // ─── Guardar ──────────────────────────
  const btn = el('btn-guardar');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    run(`INSERT INTO expedientes(
      anio,nro,codigo,origen,codigo_origen,origen_desc,gm_adjuntas,
      fecha_ingreso,cabecera,asunto,folios,
      adj_copia,adj_orig,adj_cd,adj_usb,
      responsable_id,responsable_otros,fecha_entrega_resp,
      estado,registrado_por)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [yr,nro,codigo,origen,codreg||null,otroDesc||null,gmAdj||null,
       fecha,cab||null,asunto,folios,
       adjCopia,adjOrig,adjCd,adjUsb,
       respId,respOtros,fechaResp,estado,getCU().username]);

    const newId = lastId();

    // Movimiento inicial automático
    const movObs = `Expediente registrado. Origen: ${origen}${codreg ? '. Cód: ' + codreg : ''}`;
    run(`INSERT INTO movimientos(expediente_id,tipo,fecha,observaciones,usuario)
         VALUES(?,?,?,?,?)`, [newId,'OBS',fecha,movObs,getCU().username]);

    // Derivación inicial
    if (!archivado) {
      if (tipoD === 'responsable' && respId) {
        const rn = _responsables.find(r => r.id == respId)?.nombre || '';
        run(`INSERT INTO movimientos(expediente_id,tipo,fecha,responsable,observaciones,usuario)
             VALUES(?,?,?,?,?,?)`,
          [newId,'REVISION',fechaResp, rn+(respOtros?` (${respOtros})`:``), `Entregado a: ${rn}`, getCU().username]);
      }
      derivs.forEach(d =>
        run(`INSERT INTO movimientos(expediente_id,tipo,fecha,area_id,area_libre,usuario)
             VALUES(?,?,?,?,?,?)`,
          [newId,'DERIVACION',d.fecha,d.areaId||null,d.areaLibre||null,getCU().username])
      );
    }

    // Vínculo
    const vincCheck = el('n-vincular-check')?.checked;
    const vincId    = v('n-vinc-id');
    if (vincCheck && vincId) {
      run(`INSERT INTO vinculos(exp_origen,exp_destino,tipo,nota,creado_por)
           VALUES(?,?,?,?,?)`,
        [newId, parseInt(vincId), v('n-vinc-tipo'), v('n-vinc-nota')||null, getCU().username]);
    }

    audit('NUEVO EXPEDIENTE', `${cab||'Sin cabecera'} — ${asunto.substring(0,60)}`,
          'expedientes', newId, codigo);
    showAlert('al-nuevo', `✓ Expediente ${codigo} registrado correctamente`);
    _resetFormNuevo();
    _autoGDTI();
    loadDash();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar Expediente'; }
  }
}

// ═══════════════════════════════════════════
// EDITAR EXPEDIENTE
// ═══════════════════════════════════════════
export function abrirEditar(id) {
  const e = q1(`SELECT * FROM expedientes WHERE id=?`, [id]);
  if (!e) return;

  el('modal-editar-content').innerHTML = `
    <button class="modal-x" onclick="window.cerrarModal('ov-editar')">×</button>
    <h3>Editar Expediente <span class="code" style="font-size:1rem">${esc(e.codigo)}</span></h3>
    <input type="hidden" id="ed-id" value="${e.id}">
    <input type="hidden" id="ed-codigo" value="${esc(e.codigo)}">
    <div class="fgrid">
      <div class="fg2 full">
        <label>Cabecera del documento</label>
        <input id="ed-cabecera" value="${esc(e.cabecera||'')}" oninput="this.value=this.value.toUpperCase()">
      </div>
      <div class="fg2"><label>Folios</label><input id="ed-folios" type="number" min="1" value="${e.folios||''}"></div>
      <div class="fg2">
        <label style="display:block;font-size:.73rem;font-weight:600;color:var(--text2);margin-bottom:10px;letter-spacing:.05em;text-transform:uppercase">Adjuntos</label>
        <div class="adj-row"><label>Juegos en copia</label><input type="number" class="adj-num" id="eed-copia" value="${e.adj_copia||0}" min="0" max="9"></div>
        <div class="adj-row"><label>Juegos en original</label><input type="number" class="adj-num" id="eed-orig" value="${e.adj_orig||0}" min="0" max="9"></div>
        <div class="adj-row"><label>CD</label><input type="number" class="adj-num" id="eed-cd" value="${e.adj_cd||0}" min="0" max="9"></div>
        <div class="adj-row"><label>USB</label><input type="number" class="adj-num" id="eed-usb" value="${e.adj_usb||0}" min="0" max="9"></div>
      </div>
      <div class="fg2 full"><label>Asunto</label><textarea id="ed-asunto">${esc(e.asunto)}</textarea></div>
      <div class="fg2"><label>Responsable interno</label><select id="ed-resp"><option value="">— Sin asignar —</option></select></div>
      <div class="fg2" id="ed-resp-otros-wrap" style="display:none">
        <label>Especificar</label><input id="ed-resp-otros" value="${esc(e.responsable_otros||'')}" oninput="this.value=this.value.toUpperCase()">
      </div>
      <div class="fg2 full"><label>Observaciones</label><textarea id="ed-obs" style="min-height:52px">${esc(e.observaciones||'')}</textarea></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="window.cerrarModal('ov-editar')">Cancelar</button>
      <button class="btn btn-primary" onclick="window.guardarEdicion()">Guardar cambios</button>
    </div>
  `;

  fillResp('ed-resp');
  sv('ed-resp', e.responsable_id || '');
  onRespChange('ed-resp', 'ed-resp-otros-wrap');
  el('ed-resp')?.addEventListener('change', () => onRespChange('ed-resp','ed-resp-otros-wrap'));
  abrir('ov-editar');
}

export function guardarEdicion() {
  const id     = v('ed-id');
  const codigo = v('ed-codigo');
  const anterior = q1(`SELECT cabecera, asunto, folios FROM expedientes WHERE id=?`, [id]);

  run(`UPDATE expedientes
       SET cabecera=?, folios=?, asunto=?,
           adj_copia=?, adj_orig=?, adj_cd=?, adj_usb=?,
           responsable_id=?, responsable_otros=?, observaciones=?
       WHERE id=?`,
    [v('ed-cabecera').toUpperCase() || null,
     parseInt(v('ed-folios')) || null,
     v('ed-asunto'),
     parseInt(el('eed-copia')?.value) || 0,
     parseInt(el('eed-orig')?.value)  || 0,
     parseInt(el('eed-cd')?.value)    || 0,
     parseInt(el('eed-usb')?.value)   || 0,
     v('ed-resp') || null,
     v('ed-resp-otros') || null,
     v('ed-obs') || null,
     id]);

  const valorAnterior = `Cabecera: ${anterior?.cabecera||'—'} | Asunto: ${anterior?.asunto?.substring(0,40)||'—'}`;
  audit('EDICIÓN', 'Datos del expediente modificados', 'expedientes', id, codigo, valorAnterior);
  cerrar('ov-editar');
  buscar();
}

// ═══════════════════════════════════════════
// CAMBIAR ESTADO
// ═══════════════════════════════════════════
export function abrirEstado(id, estadoActual) {
  sv('est-id',  id);
  sv('est-val', estadoActual || 'EN TRÁMITE');
  abrir('ov-estado');
}

export function guardarEstado() {
  const id  = v('est-id');
  const est = v('est-val');
  const exp = q1(`SELECT codigo, estado FROM expedientes WHERE id=?`, [id]);

  run(`UPDATE expedientes SET estado=? WHERE id=?`, [est, id]);
  run(`INSERT INTO movimientos(expediente_id,tipo,fecha,observaciones,usuario)
       VALUES(?,?,?,?,?)`,
    [id,'OBS',today(),`Estado actualizado a: ${est}`, getCU().username]);

  audit('CAMBIO ESTADO', `Nuevo estado: ${est}`, 'expedientes', id, exp?.codigo || '', `Estado anterior: ${exp?.estado || '—'}`);
  cerrar('ov-estado');
  buscar();
  loadDash();
}

// ─── Exponer al HTML ──────────────────────
window.guardarExpediente = guardarExpediente;
window.guardarEdicion    = guardarEdicion;
window.abrirEditar       = abrirEditar;
window.abrirEstado       = abrirEstado;
window.guardarEstado     = guardarEstado;
