import type { Payment } from '../types/payment.types';
import { CONTACTO } from '../config/contacto';

type ComprobanteData = {
  pago: Payment;
  clienteNombre: string;
  lotKey: string;
  developmentName: string;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (value: number) =>
  `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const longDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Absolute URL: the receipt opens in a new blank window, not under the portal's path.
const logoUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}images/ruiz-inmobiliaria-emblema-256.png`;

/**
 * Opens a printable payment receipt for a paid installment, in the brand's
 * black and gold, like the admin's receipt. The client can print it or save it
 * as PDF from the browser dialog. It isn't a tax invoice.
 */
export function openComprobante({ pago, clienteNombre, lotKey, developmentName }: ComprobanteData): boolean {
  const ventana = window.open('', '_blank');
  if (!ventana) return false;

  const bd = pago.breakdown;
  const desglose = [
    bd ? [pago.reason.split(' · ')[0] || 'Mensualidad', bd.base] : null,
    bd && bd.cargoExtra > 0 ? ['Cargos extra', bd.cargoExtra] : null,
    bd && bd.recargo > 0 ? ['Recargo por atraso', bd.recargo] : null,
    bd && (bd.pagoAdicional ?? 0) > 0 ? ['Pago adicional', bd.pagoAdicional ?? 0] : null,
    bd && (bd.abonoSaldoFavor ?? 0) > 0 ? ['Abono a saldo a favor', bd.abonoSaldoFavor ?? 0] : null,
  ].filter((row): row is [string, number] => row !== null);

  const registros = pago.pagos ?? [];
  const pagos = registros.map((registro) =>
    `<tr><td>${escapeHtml(longDate(registro.fecha))}</td><td>${escapeHtml(registro.formaPago)}</td><td class="num">${money(registro.monto)}</td></tr>`
  ).join('');
  const fechaPago = registros.length ? registros[registros.length - 1].fecha : pago.date;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comprobante de pago ${escapeHtml(pago.id)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; background: #f4f4f2; font-size: 13px; }
  .hoja { max-width: 720px; margin: 24px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
  .cabecera { background: #111; color: #fff; padding: 20px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 4px solid #eaae4c; }
  .marca { display: flex; align-items: center; gap: 12px; }
  .marca img { width: 48px; height: 48px; object-fit: contain; }
  .marca .nombre { font-size: 20px; font-weight: 800; letter-spacing: .5px; }
  .marca .sub { font-size: 10px; letter-spacing: 3px; color: #eaae4c; }
  .titulo { text-align: right; }
  .titulo .doc { font-size: 11px; letter-spacing: 2px; color: #eaae4c; text-transform: uppercase; }
  .titulo .folio { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .cuerpo { padding: 24px 28px; }
  .datos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; margin-bottom: 20px; }
  .dato .etiqueta { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
  .dato .valor { font-size: 13px; font-weight: 600; margin-top: 2px; }
  .total { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #fdf7ec; border: 1px solid #f3d49a; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; }
  .total .etiqueta { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
  .total .monto { font-size: 28px; font-weight: 800; color: #111; }
  .estado { display: inline-block; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-top: 4px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 8px 4px; border-bottom: 1px solid #ececec; text-align: left; }
  th { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  .suma td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; }
  .pie { border-top: 1px solid #ececec; padding: 16px 28px 22px; font-size: 11px; color: #6b7280; line-height: 1.6; }
  .pie strong { color: #374151; }
  .acciones { text-align: center; margin: 0 auto 32px; }
  .acciones button { background: #111; color: #fff; border: 0; border-radius: 999px; padding: 10px 22px; font-size: 13px; font-weight: 600; cursor: pointer; }
  @media (max-width: 560px) { .datos { grid-template-columns: 1fr; } .cabecera { flex-direction: column; align-items: flex-start; } .titulo { text-align: left; } }
  @media print {
    body { background: #fff; }
    .hoja { box-shadow: none; margin: 0; max-width: none; border-radius: 0; }
    .acciones { display: none; }
    .cabecera, .total, .estado { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head>
<body>
  <div class="hoja">
    <div class="cabecera">
      <div class="marca">
        <img src="${logoUrl()}" alt="">
        <div>
          <div class="nombre">RUIZ</div>
          <div class="sub">INMOBILIARIA</div>
        </div>
      </div>
      <div class="titulo">
        <div class="doc">Comprobante de pago</div>
        <div class="folio">Folio ${escapeHtml(pago.id)}</div>
      </div>
    </div>

    <div class="cuerpo">
      <div class="datos">
        <div class="dato"><div class="etiqueta">Cliente</div><div class="valor">${escapeHtml(clienteNombre)}</div></div>
        <div class="dato"><div class="etiqueta">Fecha de pago</div><div class="valor">${escapeHtml(longDate(fechaPago))}</div></div>
        <div class="dato"><div class="etiqueta">Desarrollo</div><div class="valor">${escapeHtml(developmentName)}</div></div>
        <div class="dato"><div class="etiqueta">Lote</div><div class="valor">${escapeHtml(lotKey)}</div></div>
        <div class="dato"><div class="etiqueta">Concepto</div><div class="valor">${escapeHtml(pago.reason.split(' · ')[0] || pago.reason)}</div></div>
        <div class="dato"><div class="etiqueta">Periodo</div><div class="valor">${escapeHtml(longDate(pago.dueDate))}</div></div>
      </div>

      <div class="total">
        <div>
          <div class="etiqueta">Total pagado</div>
          <div class="estado">Pagado</div>
        </div>
        <div class="monto">${money(pago.amount)}</div>
      </div>

      <h2>Desglose</h2>
      <table>
        ${desglose.map(([concepto, monto]) => `<tr><td>${escapeHtml(concepto)}</td><td class="num">${money(monto)}</td></tr>`).join('')}
        <tr class="suma"><td>Total pagado</td><td class="num">${money(pago.amount)}</td></tr>
      </table>

      ${pagos ? `<h2>Cómo se pagó</h2><table><tr><th>Fecha</th><th>Forma de pago</th><th class="num">Monto</th></tr>${pagos}</table>` : ''}
    </div>

    <div class="pie">
      <strong>Ruiz Inmobiliaria</strong> · ${escapeHtml(CONTACTO.direccion)}<br>
      WhatsApp y teléfono ${escapeHtml(CONTACTO.telefonoVisible)} · ${escapeHtml(CONTACTO.email)} · ${escapeHtml(CONTACTO.horario)}<br>
      Este documento es un comprobante de pago y no es un comprobante fiscal.
    </div>
  </div>
  <div class="acciones"><button onclick="window.print()">Imprimir o guardar como PDF</button></div>
</body></html>`;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  return true;
}
