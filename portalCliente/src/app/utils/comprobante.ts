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

/**
 * Opens a printable payment receipt for a paid installment. The client can
 * print it or save it as PDF from the browser dialog. It isn't a tax invoice.
 */
export function openComprobante({ pago, clienteNombre, lotKey, developmentName }: ComprobanteData): boolean {
  const ventana = window.open('', '_blank');
  if (!ventana) return false;

  const bd = pago.breakdown;
  const desglose = [
    bd ? ['Mensualidad / concepto', bd.base] : null,
    bd && bd.cargoExtra > 0 ? ['Cargos extra', bd.cargoExtra] : null,
    bd && bd.recargo > 0 ? ['Recargo por mora', bd.recargo] : null,
    bd && (bd.servicios ?? 0) > 0 ? ['Servicios / extra', bd.servicios ?? 0] : null,
  ].filter((row): row is [string, number] => row !== null);

  const pagos = (pago.pagos ?? []).map((registro) =>
    `<tr><td>${escapeHtml(longDate(registro.fecha))}</td><td>${escapeHtml(registro.formaPago)}</td><td class="num">${money(registro.monto)}</td></tr>`
  ).join('');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Comprobante de pago ${escapeHtml(pago.id)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 40px; font-size: 13px; }
  h1 { font-size: 20px; margin: 0; color: #0f766e; }
  h2 { font-size: 14px; margin: 24px 0 8px; }
  .muted { color: #6b7280; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  .num { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; border-top: 2px solid #1f2937; }
  .grid td:first-child { color: #6b7280; width: 40%; }
  .print { margin-top: 28px; }
  @media print { .print { display: none; } body { margin: 16px; } }
</style></head>
<body>
  <h1>Ruiz Inmobiliaria</h1>
  <p class="muted">Comprobante de pago · no es un comprobante fiscal</p>

  <h2>Datos del pago</h2>
  <table class="grid">
    <tr><td>Folio</td><td>${escapeHtml(pago.id)}</td></tr>
    <tr><td>Cliente</td><td>${escapeHtml(clienteNombre)}</td></tr>
    <tr><td>Desarrollo</td><td>${escapeHtml(developmentName)}</td></tr>
    <tr><td>Lote</td><td>${escapeHtml(lotKey)}</td></tr>
    <tr><td>Concepto</td><td>${escapeHtml(pago.reason)}</td></tr>
    <tr><td>Vencimiento</td><td>${escapeHtml(longDate(pago.dueDate))}</td></tr>
  </table>

  <h2>Desglose</h2>
  <table>
    ${desglose.map(([concepto, monto]) => `<tr><td>${escapeHtml(concepto)}</td><td class="num">${money(monto)}</td></tr>`).join('')}
    <tr class="total"><td>Total pagado</td><td class="num">${money(pago.amount)}</td></tr>
  </table>

  ${pagos ? `<h2>Pagos registrados</h2><table><tr><th>Fecha</th><th>Forma de pago</th><th class="num">Monto</th></tr>${pagos}</table>` : ''}

  <p class="muted" style="margin-top:28px">
    Dudas: WhatsApp o teléfono ${escapeHtml(CONTACTO.telefonoVisible)} · ${escapeHtml(CONTACTO.email)}
  </p>
  <button class="print" onclick="window.print()">Imprimir o guardar como PDF</button>
</body></html>`;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  return true;
}
