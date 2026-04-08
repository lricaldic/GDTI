// ═══════════════════════════════════════════
// print.js — Impresión de historial de expediente
// ═══════════════════════════════════════════
import { q, q1 } from './db.js';
import { esc, fmtDate, origenLabel } from './ui.js';

const TIPOS_MOV = {
  DERIVACION:'Derivación interna', DERIVACION_EXT:'Derivación externa',
  RESPUESTA:'Respuesta recibida',  SALIDA:'Salida/Notificación',
  INFORME:'Informe emitido',       REVISION:'Revisión interna',
  OBS:'Observación'
};

export function imprimirExpediente(id, codigo) {
  const e = q1(`SELECT * FROM expedientes WHERE id=?`, [id]);
  if (!e) return;

  const movs  = q(`
    SELECT m.*, a.sigla AS a_sig, a.nombre AS a_nom
    FROM movimientos m
    LEFT JOIN areas a ON m.area_id = a.id
    WHERE m.expediente_id = ?
    ORDER BY m.fecha, m.id`, [id]);

  const vincs = q(`
    SELECT v.*, e1.codigo AS c1, e2.codigo AS c2
    FROM vinculos v
    JOIN expedientes e1 ON v.exp_origen  = e1.id
    JOIN expedientes e2 ON v.exp_destino = e2.id
    WHERE v.exp_origen = ? OR v.exp_destino = ?`, [id, id]);

  const adjs = [];
  if (e.adj_copia > 0) adjs.push(`${e.adj_copia} jgo(s). copia`);
  if (e.adj_orig  > 0) adjs.push(`${e.adj_orig} jgo(s). original`);
  if (e.adj_cd    > 0) adjs.push(`${e.adj_cd} CD`);
  if (e.adj_usb   > 0) adjs.push(`${e.adj_usb} USB`);

  const fechaGen = new Date().toLocaleDateString('es-PE', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <div class="print-title">GERENCIA DE DESARROLLO TERRITORIAL E INFRAESTRUCTURA</div>
      <div class="print-sub">Historial de Movimientos — Expediente ${esc(e.codigo)}</div>
      <div class="print-sub">Generado: ${fechaGen}</div>
    </div>

    <div class="print-datos">
      <div class="print-dato">
        <div class="dl">Código GDTI</div>
        <div class="dv">${esc(e.codigo)}</div>
      </div>
      <div class="print-dato">
        <div class="dl">Fecha de ingreso</div>
        <div class="dv">${fmtDate(e.fecha_ingreso)}</div>
      </div>
      <div class="print-dato full">
        <div class="dl">Cabecera del documento</div>
        <div class="dv">${esc(e.cabecera||'—')}</div>
      </div>
      <div class="print-dato full">
        <div class="dl">Asunto</div>
        <div class="dv">${esc(e.asunto)}</div>
      </div>
      <div class="print-dato">
        <div class="dl">Origen</div>
        <div class="dv">${origenLabel(e.origen,e.origen_desc,e.gm_adjuntas)}${e.codigo_origen?' — N°'+esc(e.codigo_origen):''}</div>
      </div>
      <div class="print-dato">
        <div class="dl">Estado actual</div>
        <div class="dv">${esc(e.estado)}</div>
      </div>
      <div class="print-dato">
        <div class="dl">Folios</div>
        <div class="dv">${esc(e.folios||'—')}${adjs.length?' + '+adjs.join(', '):''}</div>
      </div>
    </div>

    ${vincs.length ? `
      <div style="margin-bottom:10px;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:10px">
        <strong>Expedientes vinculados:</strong>
        ${vincs.map(vv => `${esc(vv.c1)} ↔ ${esc(vv.c2)} (${esc(vv.tipo)}${vv.nota?': '+esc(vv.nota):''})`).join(' | ')}
      </div>` : ''}

    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px">
      Historial de movimientos (${movs.length})
    </div>

    ${movs.map(m => `
      <div class="print-mov">
        <div class="print-mov-fecha">${fmtDate(m.fecha)}</div>
        <div>
          <div class="print-mov-tipo">${TIPOS_MOV[m.tipo] || esc(m.tipo)}</div>
          <div class="print-mov-det">
            ${m.a_sig    ? `Área: [${esc(m.a_sig)}] ${esc(m.a_nom)}<br>` : ''}
            ${m.area_libre ? `Área: ${esc(m.area_libre)}<br>` : ''}
            ${m.cabecera ? `Doc: ${esc(m.cabecera)}<br>` : ''}
            ${m.responsable ? `Responsable: ${esc(m.responsable)}<br>` : ''}
            ${m.medio    ? `Medio: ${esc(m.medio)}<br>` : ''}
            ${m.observaciones ? esc(m.observaciones) : ''}
            ${m.usuario  ? `<span style="color:#aaa;font-size:9px"> — ${esc(m.usuario)}</span>` : ''}
          </div>
        </div>
      </div>`).join('')}

    <div class="print-footer">
      <span>Sistema GDTI — Registro Documentario Oficial</span>
      <span>${new Date().toLocaleDateString('es-PE')}</span>
    </div>
  `;

  window.print();
}

window.imprimirExpediente = imprimirExpediente;
