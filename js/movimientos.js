// ═══════════════════════════════════════════
// movimientos.js — Registro de movimientos
// ═══════════════════════════════════════════
import { q, q1, run, runAsync, _areas, _responsables, reloadCache } from './db.js';
import { el, v, sv, showB, esc, today,
         fillAreaSelect, fillResp, onRespChange,
         abrir, cerrar, SIGLAS_DERIV }                      from './ui.js';
import { getCU } from './state.js';
import { audit } from './auditoria.js';
import { buscar } from './buscar.js';

let recibDerivCounter = 0;

// ═══════════════════════════════════════════
// ABRIR MODAL
// ═══════════════════════════════════════════
export function abrirMov(expId, codigo, fechaIngreso) {
  reloadCache();
  _renderModalMov(expId, codigo, fechaIngreso);
  abrir('ov-mov');
}

function _renderModalMov(expId, codigo, fechaIngreso) {
  if (el('mov-emis-areas-list')) el('mov-emis-areas-list').innerHTML = '';
  emisDerivCounter = 0;
  const rdEmis = el('emis-rd-interna'); if (rdEmis) rdEmis.checked = true;
  recibDerivCounter = 0;

  el('modal-mov-content').innerHTML = `
    <button class="modal-x" onclick="window.cerrarModal('ov-mov')">×</button>
    <h3>Movimiento — Expediente <span class="code" style="font-size:1rem">${esc(codigo)}</span></h3>
    <input type="hidden" id="mov-exp-id"    value="${expId}">
    <input type="hidden" id="mov-exp-codigo" value="${esc(codigo)}">
    <input type="hidden" id="mov-exp-fecha"  value="${esc(fechaIngreso||today())}">

    <div class="fgrid">
      <div class="fg2 full">
        <label>Tipo de movimiento <span class="req">*</span></label>
        <select id="mov-tipo" onchange="window._updMovUI()">
          <option value="">— Seleccionar —</option>
          <option value="RECIBIDO">Documento recibido (continuación / respuesta)</option>
          <option value="EMISION">Emisión de documento GDTI</option>
          <option value="OBS">Observación / Nota interna</option>
        </select>
      </div>
    </div>

    <!-- PANEL RECIBIDO -->
    <div id="panel-recibido" style="display:none">
      <div class="divider" style="margin:14px 0 16px"></div>
      <div class="sec-hdr">Datos del documento recibido</div>
      <div class="fgrid">
        <div class="fg2 full">
          <label>Cabecera del documento <span class="req">*</span></label>
          <input id="mov-recib-cab" placeholder="Ej: INFORME N°203-2026-SGI-GDTI/MPA"
            oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="fg2">
          <label>Fecha de recepción en GDTI <span class="req">*</span></label>
          <input type="date" id="mov-recib-fecha" value="${today()}">
        </div>
        <div class="fg2">
          <label>Folios <span class="req">*</span></label>
          <input type="number" id="mov-recib-folios" min="1" placeholder="Nro. de folios">
        </div>
        <div class="fg2 full">
          <label>Asunto <span style="color:var(--text3);font-weight:400">(opcional — solo si difiere del expediente)</span></label>
          <textarea id="mov-recib-asunto" placeholder="Dejar vacío si el asunto es el mismo..." style="min-height:52px"></textarea>
        </div>
        <div class="fg2">
          <label>Origen del documento <span class="req">*</span></label>
          <select id="mov-recib-origen" onchange="window._updRecibOrigenUI()">
            <option value="">— Seleccionar —</option>
            <option value="SGI">SGI</option>
            <option value="SGDT">SGDT – Catastro</option>
            <option value="OGRD">OGRD – Defensa Civil</option>
            <option value="SGI-OOP">SGI-OOP – Obras Públicas</option>
            <option value="SGI-OEP">SGI-OEP – Estudios y Proyectos</option>
            <option value="SGI-OFI">SGI-OFI – Formulación de Inversiones</option>
            <option value="ALC">Alcaldía</option>
            <option value="GM">Gerencia Municipal</option>
            <option value="OTRO">Otro (especificar)</option>
          </select>
        </div>
        <div class="fg2">
          <label>N° registro del área de origen <span style="color:var(--text3);font-weight:400">(opcional)</span></label>
          <input id="mov-recib-nreg" placeholder="Ej: 023" oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="fg2 full" id="mov-recib-otro-wrap" style="display:none">
          <label>Especificar origen <span class="req">*</span></label>
          <input id="mov-recib-otro" placeholder="Siglas o nombre del área"
            oninput="this.value=this.value.toUpperCase()">
        </div>
      </div>
      <div class="divider" style="margin:14px 0"></div>
      <div class="sec-hdr">Derivación del documento recibido</div>
      <div style="display:flex;gap:18px;margin-bottom:12px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
          <input type="radio" name="recib-deriv-tipo" id="recib-rd-resp" value="responsable"
            onchange="window._updRecibDerivUI()" checked>Responsable interno
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
          <input type="radio" name="recib-deriv-tipo" id="recib-rd-area" value="area"
            onchange="window._updRecibDerivUI()">Área interna
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
          <input type="radio" name="recib-deriv-tipo" id="recib-rd-ninguna" value="ninguna"
            onchange="window._updRecibDerivUI()">Sin derivación aún
        </label>
      </div>
      <div id="recib-panel-resp" class="fgrid">
        <div class="fg2">
          <label>Responsable <span class="req">*</span></label>
          <select id="mov-recib-resp"
            onchange="window._onRecibRespChange()"><option value="">— Seleccionar —</option></select>
        </div>
        <div class="fg2" id="mov-recib-resp-otros-wrap" style="display:none">
          <label>Especificar</label>
          <input id="mov-recib-resp-otros" oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="fg2">
          <label>Fecha de entrega <span class="req">*</span></label>
          <input type="date" id="mov-recib-fecha-deriv" value="${today()}">
        </div>
      </div>
      <div id="recib-panel-area" style="display:none">
        <div id="mov-recib-areas-list"></div>
        <button class="btn btn-gold btn-xs" style="margin-top:6px"
          onclick="window._addRecibDerivRow()">+ Agregar área</button>
      </div>
    </div>

    <!-- PANEL EMISIÓN DE DOCUMENTO GDTI -->
    <div id="panel-emision" style="display:none">
      <div class="divider" style="margin:14px 0 16px"></div>
      <div class="sec-hdr">Datos del documento emitido</div>
      <div class="fgrid">
        <div class="fg2 full">
          <label>Cabecera del documento <span class="req">*</span></label>
          <input id="mov-emis-cab" placeholder="Ej: INFORME N°015-2026-GDTI  |  CARTA N°045-2026-GDTI"
            oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="fg2">
          <label>Fecha <span class="req">*</span></label>
          <input type="date" id="mov-emis-fecha" value="${today()}">
        </div>
        <div class="fg2">
          <label>Folios <span style="color:var(--text3);font-weight:400">(opcional)</span></label>
          <input type="number" id="mov-emis-folios" min="1" placeholder="Nro. de folios">
        </div>
        <div class="fg2 full">
          <label>Asunto <span style="color:var(--text3);font-weight:400">(opcional)</span></label>
          <textarea id="mov-emis-asunto" placeholder="Solo si difiere del expediente original..." style="min-height:52px"></textarea>
        </div>
      </div>
      <div class="divider" style="margin:14px 0"></div>
      <div class="sec-hdr">Derivación del documento emitido</div>
      <div style="display:flex;gap:18px;margin-bottom:12px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
          <input type="radio" name="emis-deriv-tipo" id="emis-rd-interna" value="interna"
            onchange="window._updEmisDerivUI()" checked>Derivación interna (subárea GDTI)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
          <input type="radio" name="emis-deriv-tipo" id="emis-rd-externa" value="externa"
            onchange="window._updEmisDerivUI()">Derivación externa (GM, Alcaldía, etc.)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
          <input type="radio" name="emis-deriv-tipo" id="emis-rd-ninguna" value="ninguna"
            onchange="window._updEmisDerivUI()">Sin derivación
        </label>
      </div>
      <!-- Derivación interna -->
      <div id="emis-panel-interna">
        <div id="mov-emis-areas-list"></div>
        <button class="btn btn-gold btn-xs" style="margin-top:6px"
          onclick="window._addEmisDerivRow()">+ Agregar área</button>
      </div>
      <!-- Derivación externa -->
      <div id="emis-panel-externa" style="display:none" class="fgrid">
        <div class="fg2">
          <label>Área / Institución destino <span class="req">*</span></label>
          <select id="mov-emis-area-ext"><option value="">— Seleccionar —</option></select>
        </div>
        <div class="fg2">
          <label>Fecha de derivación <span class="req">*</span></label>
          <input type="date" id="mov-emis-fecha-ext" value="${today()}">
        </div>
      </div>
    </div>

    <!-- PANEL OBSERVACIÓN -->
    <div id="panel-obs" style="display:none">
      <div class="fgrid" style="margin-top:14px">
        <div class="fg2">
          <label>Fecha <span class="req">*</span></label>
          <input type="date" id="mov-obs-fecha" value="${today()}">
        </div>
      </div>
    </div>

    <!-- OBSERVACIONES siempre visible -->
    <div class="fg2 full" style="margin-top:14px">
      <label>Observaciones</label>
      <textarea id="mov-obs" placeholder="Notas adicionales..." style="min-height:52px"></textarea>
    </div>

    <!-- VINCULACIÓN -->
    <div style="margin-top:14px;padding:12px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border)">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.875rem;font-weight:600;color:var(--navy)">
        <input type="checkbox" id="mov-vincular-check"
          onchange="window._updMovVincularUI()" style="width:16px;height:16px;cursor:pointer">
        Vincular con otro registro GDTI
      </label>
      <div id="mov-vincular-panel" style="display:none;margin-top:12px">
        <div class="fgrid">
          <div class="fg2">
            <label>Código GDTI a vincular</label>
            <div style="display:flex;gap:8px">
              <input id="mov-vinc-codigo" placeholder="Ej: 2026-045" style="flex:1"
                oninput="this.value=this.value.toUpperCase()">
              <button class="btn btn-gold btn-sm"
                onclick="window._buscarVinculoMov()">Buscar</button>
            </div>
            <div id="mov-vinc-res" class="hint" style="margin-top:6px"></div>
            <input type="hidden" id="mov-vinc-id">
          </div>
          <div class="fg2">
            <label>Tipo de vínculo</label>
            <select id="mov-vinc-tipo">
              <option value="RELACIONADO">Relacionado</option>
              <option value="CONTINUACION">Continuación de ese registro</option>
              <option value="RESPUESTA_MULTIPLE">Respuesta múltiple (varios → uno)</option>
            </select>
          </div>
          <div class="fg2 full">
            <label>Nota explicativa</label>
            <input id="mov-vinc-nota" placeholder="Ej: Este informe responde también al GDTI-2026-045">
          </div>
        </div>
      </div>
    </div>

    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="window.cerrarModal('ov-mov')">Cancelar</button>
      <button class="btn btn-primary" onclick="window.guardarMovimiento()">Guardar movimiento</button>
    </div>
  `;

  fillAreaSelect('mov-area');
  fillResp('mov-recib-resp');
  showB('panel-recibido', false);
  showB('panel-simple', false);
}

// ─── Helpers internos del modal ──────────
function _updMovUI() {
  const t = v('mov-tipo');
  showB('panel-recibido', t === 'RECIBIDO');
  showB('panel-emision',  t === 'EMISION');
  showB('panel-obs',      t === 'OBS');
  if (t === 'EMISION') {
    _updEmisDerivUI();
    fillAreaSelect('mov-emis-area-ext');
    if (el('mov-emis-areas-list') && !el('mov-emis-areas-list').children.length) _addEmisDerivRow();
  }
}

function _updEmisDerivUI() {
  const tipo = document.querySelector('input[name="emis-deriv-tipo"]:checked')?.value || 'interna';
  showB('emis-panel-interna', tipo === 'interna');
  showB('emis-panel-externa', tipo === 'externa');
  if (tipo === 'interna' && el('mov-emis-areas-list') && !el('mov-emis-areas-list').children.length) {
    _addEmisDerivRow();
  }
}

let emisDerivCounter = 0;
function _addEmisDerivRow(areaId='', fecha='') {
  emisDerivCounter++;
  const id = `edrv-${emisDerivCounter}`;
  const areas = _areas.filter(a => SIGLAS_DERIV.includes(a.sigla));
  let opts = `<option value="">— Área —</option>`;
  areas.forEach(a => opts += `<option value="${a.id}" ${String(a.id)===String(areaId)?'selected':''}>[${esc(a.sigla)}] ${esc(a.nombre)}</option>`);
  opts += `<option value="OTRO">OTRO (especificar)</option>`;
  const div = document.createElement('div');
  div.className = 'deriv-item'; div.id = id;
  div.innerHTML = `
    <select style="flex:2" onchange="window._updEmisOtro('${id}')">${opts}</select>
    <input type="date" value="${fecha||today()}" style="flex:1;min-width:110px">
    <button class="deriv-remove" onclick="document.getElementById('${id}').remove()">×</button>
    <input type="text" id="${id}-otro" placeholder="Siglas" maxlength="20"
      oninput="this.value=this.value.toUpperCase()"
      style="display:none;flex:1 1 100%;margin-top:6px;padding:6px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:.82rem;background:#fff;outline:none">`;
  el('mov-emis-areas-list').appendChild(div);
}
function _updEmisOtro(id) {
  const sel = el(id)?.querySelector('select');
  const inp = el(`${id}-otro`);
  if (inp) inp.style.display = sel?.value === 'OTRO' ? '' : 'none';
}
function _getEmisDerivs() {
  const items = el('mov-emis-areas-list')?.querySelectorAll('.deriv-item') || [];
  const result = [];
  items.forEach(item => {
    const sel   = item.querySelector('select');
    const date  = item.querySelector('input[type=date]');
    const libre = item.querySelector('input[type=text]');
    if (!sel?.value) return;
    if (sel.value === 'OTRO') {
      const txt = libre?.value?.trim().toUpperCase();
      if (txt) result.push({ areaId:null, areaLibre:txt, fecha:date?.value||today() });
    } else {
      result.push({ areaId:parseInt(sel.value), areaLibre:null, fecha:date?.value||today() });
    }
  });
  return result;
}
function _updRecibOrigenUI() {
  showB('mov-recib-otro-wrap', v('mov-recib-origen') === 'OTRO');
}
function _updRecibDerivUI() {
  const tipo = document.querySelector('input[name="recib-deriv-tipo"]:checked')?.value || 'responsable';
  showB('recib-panel-resp', tipo === 'responsable');
  showB('recib-panel-area', tipo === 'area');
  if (tipo === 'ninguna') { showB('recib-panel-resp',false); showB('recib-panel-area',false); }
  if (tipo === 'area' && el('mov-recib-areas-list') && !el('mov-recib-areas-list').children.length) {
    _addRecibDerivRow();
  }
}
function _onRecibRespChange() {
  onRespChange('mov-recib-resp', 'mov-recib-resp-otros-wrap');
}
function _updMovVincularUI() {
  showB('mov-vincular-panel', el('mov-vincular-check')?.checked);
}
function _buscarVinculoMov() {
  const cod = v('mov-vinc-codigo').trim().toUpperCase();
  if (!cod) { if(el('mov-vinc-res')) el('mov-vinc-res').textContent = 'Ingresa un código'; return; }
  const row = q1(`SELECT id,codigo,asunto FROM expedientes WHERE codigo LIKE ?`, [`%${cod}%`]);
  if (!row) { if(el('mov-vinc-res')) el('mov-vinc-res').textContent = 'No encontrado'; sv('mov-vinc-id',''); return; }
  sv('mov-vinc-id', row.id);
  if (el('mov-vinc-res')) el('mov-vinc-res').innerHTML =
    `<span style="color:var(--green)">✓ ${esc(row.codigo)} — ${esc(row.asunto.substring(0,50))}</span>`;
}

// Filas de derivación en el modal de movimiento
function _addRecibDerivRow(areaId='',fecha='') {
  recibDerivCounter++;
  const id = `rdrv-${recibDerivCounter}`;
  const areas = _areas.filter(a => SIGLAS_DERIV.includes(a.sigla));
  let opts = `<option value="">— Área —</option>`;
  areas.forEach(a =>
    opts += `<option value="${a.id}" ${String(a.id)===String(areaId)?'selected':''}>[${esc(a.sigla)}] ${esc(a.nombre)}</option>`
  );
  opts += `<option value="OTRO">OTRO (especificar)</option>`;
  const div = document.createElement('div');
  div.className = 'deriv-item'; div.id = id;
  div.innerHTML = `
    <select style="flex:2" onchange="window._updRecibOtro('${id}')">${opts}</select>
    <input type="date" value="${fecha||today()}" style="flex:1;min-width:110px">
    <button class="deriv-remove" onclick="document.getElementById('${id}').remove()">×</button>
    <input type="text" id="${id}-otro" placeholder="Siglas" maxlength="20"
      oninput="this.value=this.value.toUpperCase()"
      style="display:none;flex:1 1 100%;margin-top:6px;padding:6px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:.82rem;background:#fff;outline:none">
  `;
  el('mov-recib-areas-list').appendChild(div);
}
function _updRecibOtro(id) {
  const sel = el(id)?.querySelector('select');
  const inp = el(`${id}-otro`);
  if (inp) inp.style.display = sel?.value === 'OTRO' ? '' : 'none';
}
function _getRecibDerivs() {
  const items = el('mov-recib-areas-list').querySelectorAll('.deriv-item');
  const result = [];
  items.forEach(item => {
    const sel   = item.querySelector('select');
    const date  = item.querySelector('input[type=date]');
    const libre = item.querySelector('input[type=text]');
    if (!sel?.value) return;
    if (sel.value === 'OTRO') {
      const txt = libre?.value?.trim().toUpperCase();
      if (txt) result.push({ areaId:null, areaLibre:txt, fecha:date?.value||today() });
    } else {
      result.push({ areaId:parseInt(sel.value), areaLibre:null, fecha:date?.value||today() });
    }
  });
  return result;
}

// Exponer al HTML
window._updMovUI          = _updMovUI;
window._updEmisDerivUI    = _updEmisDerivUI;
window._addEmisDerivRow   = _addEmisDerivRow;
window._updEmisOtro       = _updEmisOtro;
window._updRecibOrigenUI  = _updRecibOrigenUI;
window._updRecibDerivUI   = _updRecibDerivUI;
window._onRecibRespChange = _onRecibRespChange;
window._updMovVincularUI  = _updMovVincularUI;
window._buscarVinculoMov  = _buscarVinculoMov;
window._addRecibDerivRow  = _addRecibDerivRow;
window._updRecibOtro      = _updRecibOtro;

// ═══════════════════════════════════════════
// GUARDAR MOVIMIENTO
// ═══════════════════════════════════════════
export async function guardarMovimiento() {
  const expId  = parseInt(v('mov-exp-id'));
  const codigo = v('mov-exp-codigo');
  const tipo   = v('mov-tipo');
  if (!tipo) { alert('Selecciona el tipo de movimiento'); return; }

  const obs        = v('mov-obs').trim() || null;
  const vincCheck  = el('mov-vincular-check')?.checked;
  const vincId     = v('mov-vinc-id');
  const vincTipo   = v('mov-vinc-tipo');
  const vincNota   = v('mov-vinc-nota').trim() || null;
  if (vincCheck && !vincId) { alert('Busca y selecciona el expediente a vincular'); return; }

  // Deshabilitar botón durante el guardado
  const btnG = document.querySelector('#ov-mov .btn-primary');
  if (btnG) { btnG.disabled = true; btnG.textContent = 'Guardando...'; }

  try {
    if (tipo === 'RECIBIDO') {
      const cab      = v('mov-recib-cab').trim().toUpperCase();
      const fecha    = v('mov-recib-fecha');
      const folios   = parseInt(v('mov-recib-folios')) || null;
      const asunto   = v('mov-recib-asunto').trim() || null;
      const origen   = v('mov-recib-origen');
      const nreg     = v('mov-recib-nreg').trim().toUpperCase() || null;
      const otroDesc = v('mov-recib-otro').trim().toUpperCase() || null;
      const expFecha = v('mov-exp-fecha');
      const tipoD    = document.querySelector('input[name="recib-deriv-tipo"]:checked')?.value || 'responsable';
      const respId   = tipoD==='responsable' ? v('mov-recib-resp') || null : null;
      const respOtros = tipoD==='responsable' ? v('mov-recib-resp-otros').trim().toUpperCase() || null : null;
      const fechaDeriv = v('mov-recib-fecha-deriv') || fecha;
      const derivs   = tipoD==='area' ? _getRecibDerivs() : [];

      if (!cab)    { alert('La cabecera es obligatoria'); return; }
      if (!fecha)  { alert('La fecha de recepción es obligatoria'); return; }
      if (!folios || folios < 1) { alert('Los folios son obligatorios'); return; }
      if (!origen) { alert('Selecciona el origen del documento'); return; }
      if (origen === 'OTRO' && !otroDesc) { alert('Especifica el origen'); return; }
      if (expFecha && fecha < expFecha) { alert('La fecha de recepción no puede ser anterior a la fecha de ingreso del expediente'); return; }
      if (tipoD === 'responsable' && !respId) { alert('Selecciona el responsable'); return; }
      if (tipoD === 'area' && !derivs.length) { alert('Agrega al menos un área de derivación'); return; }

      const origenLbl = origen === 'OTRO' ? otroDesc : origen;
      const movObs = `Doc. recibido de ${origenLbl}${nreg?` (Ref: ${nreg})`:''}.`
                   + ` Folios: ${folios}${asunto?'. '+asunto:''}`
                   + `${obs?'\n'+obs:''}`;

      const ok = await runAsync(
        `INSERT INTO movimientos(expediente_id,tipo,fecha,cabecera,observaciones,usuario) VALUES(?,?,?,?,?,?)`,
        [expId,'RESPUESTA',fecha,cab,movObs,getCU().username]);
      if (!ok) { alert('Error al guardar. Intenta de nuevo.'); return; }

      if (tipoD === 'responsable' && respId) {
        const rn = _responsables.find(r => r.id == respId)?.nombre || '';
        await runAsync(
          `INSERT INTO movimientos(expediente_id,tipo,fecha,responsable,observaciones,usuario) VALUES(?,?,?,?,?,?)`,
          [expId,'REVISION',fechaDeriv, rn+(respOtros?` (${respOtros})`:''),`Entregado a: ${rn}`,getCU().username]);
      }
      for (const d of derivs) {
        await runAsync(
          `INSERT INTO movimientos(expediente_id,tipo,fecha,area_id,area_libre,usuario) VALUES(?,?,?,?,?,?)`,
          [expId,'DERIVACION',d.fecha,d.areaId||null,d.areaLibre||null,getCU().username]);
      }
      audit('MOVIMIENTO', `RECIBIDO: ${cab}`, 'movimientos', expId, codigo);

    } else if (tipo === 'EMISION') {
      const cab    = v('mov-emis-cab').trim().toUpperCase();
      const fecha  = v('mov-emis-fecha');
      const folios = parseInt(v('mov-emis-folios')) || null;
      const asunto = v('mov-emis-asunto').trim() || null;
      const tipoD  = document.querySelector('input[name="emis-deriv-tipo"]:checked')?.value || 'interna';
      const derivs = tipoD === 'interna' ? _getEmisDerivs() : [];
      const areaExtId = tipoD === 'externa' ? v('mov-emis-area-ext') || null : null;
      const fechaExt  = tipoD === 'externa' ? v('mov-emis-fecha-ext') || fecha : fecha;

      if (!cab)   { alert('La cabecera del documento es obligatoria'); return; }
      if (!fecha) { alert('La fecha es obligatoria'); return; }
      if (tipoD === 'interna' && !derivs.length) { alert('Agrega al menos un área de derivación interna'); return; }
      if (tipoD === 'externa' && !areaExtId)      { alert('Selecciona el área o institución de destino'); return; }

      const movObs = `Documento emitido.${folios?' Folios: '+folios:''}${asunto?'. '+asunto:''}${obs?'\n'+obs:''}`;
      const ok = await runAsync(
        `INSERT INTO movimientos(expediente_id,tipo,fecha,cabecera,observaciones,usuario) VALUES(?,?,?,?,?,?)`,
        [expId,'INFORME',fecha,cab,movObs,getCU().username]);
      if (!ok) { alert('Error al guardar. Intenta de nuevo.'); return; }

      if (tipoD === 'interna') {
        for (const d of derivs) {
          await runAsync(
            `INSERT INTO movimientos(expediente_id,tipo,fecha,area_id,area_libre,observaciones,usuario) VALUES(?,?,?,?,?,?,?)`,
            [expId,'DERIVACION',d.fecha,d.areaId||null,d.areaLibre||null,`Derivación de ${cab}`,getCU().username]);
        }
      } else if (tipoD === 'externa' && areaExtId) {
        await runAsync(
          `INSERT INTO movimientos(expediente_id,tipo,fecha,area_id,observaciones,usuario) VALUES(?,?,?,?,?,?)`,
          [expId,'DERIVACION_EXT',fechaExt,areaExtId,`Derivación externa de ${cab}`,getCU().username]);
      }
      audit('MOVIMIENTO', `EMISION: ${cab}`, 'movimientos', expId, codigo);

    } else if (tipo === 'OBS') {
      const fecha = v('mov-obs-fecha');
      if (!fecha) { alert('La fecha es obligatoria'); return; }
      if (!obs)   { alert('Escribe una observación'); return; }
      const ok = await runAsync(
        `INSERT INTO movimientos(expediente_id,tipo,fecha,observaciones,usuario) VALUES(?,?,?,?,?)`,
        [expId,'OBS',fecha,obs,getCU().username]);
      if (!ok) { alert('Error al guardar. Intenta de nuevo.'); return; }
      audit('MOVIMIENTO', `OBS: ${obs.substring(0,50)}`, 'movimientos', expId, codigo);
    }

    if (vincCheck && vincId) {
      await runAsync(
        `INSERT INTO vinculos(exp_origen,exp_destino,tipo,nota,creado_por) VALUES(?,?,?,?,?)`,
        [expId, parseInt(vincId), vincTipo, vincNota, getCU().username]);
    }

    cerrar('ov-mov');
    await reloadCache();
    const { buscar } = await import('./buscar.js');
    buscar();

  } finally {
    if (btnG) { btnG.disabled = false; btnG.textContent = 'Guardar movimiento'; }
  }
}

window.abrirMov          = abrirMov;
window.guardarMovimiento = guardarMovimiento;
