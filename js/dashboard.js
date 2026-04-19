// ═══════════════════════════════════════════
// dashboard.js — Panel principal
// ═══════════════════════════════════════════
import { q }                              from './db.js';
import { el, esc, bdgEstado, fmtDate }   from './ui.js';

export async function loadDash() {
  const d = new Date();
  el('dash-fecha').textContent = d.toLocaleDateString('es-PE', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  // Forzar recarga del cache para tener datos frescos
  const dbMod = await import('./db.js');
  await dbMod.reloadCache();

  // Leer expedientes del cache actualizado
  const todos = q(`SELECT * FROM expedientes ORDER BY id DESC`);
  el('s-total').textContent = todos.length;

  const ultimos = todos.slice(0, 12);
  el('dash-recent').innerHTML = ultimos.length
    ? `<div class="tbl-wrap"><table>
        <thead><tr><th>GDTI</th><th>Fecha</th><th>Cabecera / Asunto</th><th>Estado</th></tr></thead>
        <tbody>${ultimos.map(r => `<tr>
          <td><span class="code">${esc(r.codigo)}</span></td>
          <td style="font-size:.8rem;white-space:nowrap">${fmtDate(r.fecha_ingreso)}</td>
          <td style="max-width:260px">
            ${r.cabecera
              ? `<div style="font-size:.75rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px">${esc(r.cabecera)}</div>`
              : ''}
            <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px"
              title="${esc(r.asunto)}">${esc(r.asunto)}</div>
          </td>
          <td>${bdgEstado(r.estado)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`
    : `<div class="empty"><p>Sin expedientes registrados aún</p></div>`;
}
