import { useRef } from 'react'
import { Printer, X } from 'lucide-react'
import { formatDate, formatCurrency, getPagoFormaLabel } from '@/utils/helpers'

export interface ReciboPagoData {
  pagoid: number
  montopagado: number | null
  servicios_extra?: number | null
  recargo?: number | null
  fechapago: string | null
  formapago: number | null
  estatus: string | null
  referencia?: string | null
  cobrador?: string | null
  comentario?: string | null
  corridafinancieraid: number | null
  nopago?: number | null
  mensualidad?: number | null
  saldo?: number | null
  // Venta
  ventaid?: number | null
  preciolote?: number | null
  fechaventa?: string | null
  // Cliente
  clienteNombre?: string | null
  clienteEmail?: string | null
  clienteTelefono?: string | null
  // Lote
  manzana?: string | null
  nolote?: string | null
  desarrollo?: string | null
}

interface ReciboPagoProps {
  data: ReciboPagoData
  isOpen: boolean
  onClose: () => void
}

export const ReciboPago = ({ data, isOpen, onClose }: ReciboPagoProps) => {
  const printRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  const totalPagado =
    (data.montopagado ?? 0) +
    (data.servicios_extra || 0) +
    (data.recargo || 0)

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML
    if (!printContent) return

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Recibo de Pago #${data.pagoid} - Ruiz Inmobiliaria</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #1a1a1a;
            background: white;
          }
          .recibo {
            max-width: 720px;
            margin: 0 auto;
            padding: 24px;
            border: 2px solid #504840;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #eaae4c;
            padding-bottom: 16px;
            margin-bottom: 16px;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .header-left img {
            width: 64px;
            height: 64px;
            object-fit: contain;
          }
          .empresa-nombre {
            font-size: 20px;
            font-weight: bold;
            color: #504840;
            font-family: Georgia, serif;
          }
          .empresa-subtitulo {
            font-size: 12px;
            color: #777;
            margin-top: 2px;
          }
          .header-right {
            text-align: right;
          }
          .recibo-titulo {
            font-size: 22px;
            font-weight: bold;
            color: #504840;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .recibo-folio {
            font-size: 14px;
            color: #666;
            margin-top: 4px;
          }
          .recibo-folio span {
            font-weight: bold;
            color: #1a1a1a;
          }
          .section {
            margin-bottom: 14px;
          }
          .section-title {
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #777;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 4px;
            margin-bottom: 8px;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 24px;
          }
          .grid-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px 16px;
          }
          .field label {
            font-size: 10px;
            color: #888;
            display: block;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .field .value {
            font-size: 13px;
            font-weight: 600;
            color: #1a1a1a;
            margin-top: 1px;
          }
          .total-box {
            background: #f9f5ee;
            border: 2px solid #eaae4c;
            border-radius: 6px;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
          }
          .total-box .total-label {
            font-size: 13px;
            font-weight: bold;
            color: #504840;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .total-box .total-amount {
            font-size: 24px;
            font-weight: bold;
            color: #2d7a2d;
          }
          .monto-breakdown {
            font-size: 11px;
            color: #666;
            margin-top: 2px;
          }
          .saldo-box {
            background: #fff8f0;
            border: 1px solid #f0c080;
            border-radius: 4px;
            padding: 8px 12px;
            text-align: right;
          }
          .saldo-box .saldo-label {
            font-size: 10px;
            color: #888;
            text-transform: uppercase;
          }
          .saldo-box .saldo-value {
            font-size: 16px;
            font-weight: bold;
            color: #c05000;
          }
          .firmas {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            margin-top: 32px;
            padding-top: 16px;
          }
          .firma {
            text-align: center;
          }
          .firma .linea {
            border-top: 1px solid #333;
            margin-bottom: 6px;
            padding-top: 4px;
          }
          .firma .firma-label {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .footer {
            margin-top: 16px;
            text-align: center;
            font-size: 10px;
            color: #aaa;
            border-top: 1px solid #e0e0e0;
            padding-top: 10px;
          }
          .badge-pagado {
            display: inline-block;
            background: #eaae4c;
            color: #1a1a1a;
            font-weight: bold;
            font-size: 11px;
            padding: 2px 10px;
            border-radius: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const receiptContent = (
    <div className="recibo" style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: 24,
      border: '2px solid #504840',
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      color: '#1a1a1a',
      background: 'white',
    }}>
      {/* Header */}
      <div className="header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '3px solid #eaae4c',
        paddingBottom: 16,
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="/images/ruiz-inmobiliaria-logo-sin-fondo.png"
            alt="Ruiz Inmobiliaria"
            style={{ width: 64, height: 64, objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#504840', fontFamily: 'Georgia, serif' }}>
              Ruiz Inmobiliaria
            </div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
              Desarrollos y Bienes Raíces
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#504840', letterSpacing: 2, textTransform: 'uppercase' }}>
            Recibo de Pago
          </div>
          <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
            Folio: <strong style={{ color: '#1a1a1a' }}>#{data.pagoid}</strong>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{
              display: 'inline-block',
              background: '#eaae4c',
              color: '#1a1a1a',
              fontWeight: 'bold',
              fontSize: 11,
              padding: '2px 10px',
              borderRadius: 12,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Pagado
            </span>
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#777', borderBottom: '1px solid #e0e0e0', paddingBottom: 4, marginBottom: 8 }}>
          Datos del Cliente
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
          <div>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{data.clienteNombre || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Correo Electrónico</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{data.clienteEmail || '—'}</div>
          </div>
          {data.clienteTelefono && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Teléfono</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{data.clienteTelefono}</div>
            </div>
          )}
        </div>
      </div>

      {/* Inmueble */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#777', borderBottom: '1px solid #e0e0e0', paddingBottom: 4, marginBottom: 8 }}>
          Inmueble
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
          {data.desarrollo && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Desarrollo</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{data.desarrollo}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Lote</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {data.manzana && data.nolote ? `Manzana ${data.manzana} – Lote ${data.nolote}` : '—'}
            </div>
          </div>
          {data.preciolote != null && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Precio del Lote</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(data.preciolote)}</div>
            </div>
          )}
          {data.ventaid && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>No. de Venta</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{data.ventaid}</div>
            </div>
          )}
        </div>
      </div>

      {/* Detalle del Pago */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#777', borderBottom: '1px solid #e0e0e0', paddingBottom: 4, marginBottom: 8 }}>
          Detalle del Pago
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fecha de Pago</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(data.fechapago)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Forma de Pago</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{getPagoFormaLabel(data.formapago)}</div>
          </div>
          {data.nopago != null && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>No. de Pago</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{data.nopago === 0 ? 'Enganche (0)' : data.nopago}</div>
            </div>
          )}
          {data.referencia && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Referencia / Folio</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{data.referencia}</div>
            </div>
          )}
          {data.cobrador && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cobrador</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{data.cobrador}</div>
            </div>
          )}
          {data.corridafinancieraid && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Corrida Financiera ID</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{data.corridafinancieraid}</div>
            </div>
          )}
        </div>

        {/* Desglose de montos */}
        <div style={{ background: '#f9f5ee', border: '1px solid #ddd', borderRadius: 6, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: '#666' }}>
                Mensualidad: <strong>{formatCurrency(data.montopagado ?? 0)}</strong>
              </div>
              {data.servicios_extra != null && data.servicios_extra > 0 && (
                <div style={{ fontSize: 12, color: '#5b21b6', marginTop: 2 }}>
                  + Servicios/Extra: <strong>{formatCurrency(data.servicios_extra)}</strong>
                </div>
              )}
              {data.servicios_extra != null && data.servicios_extra < 0 && (
                <div style={{ fontSize: 12, color: '#5b21b6', marginTop: 2 }}>
                  – Saldo a favor aplicado: <strong>{formatCurrency(Math.abs(data.servicios_extra))}</strong>
                </div>
              )}
              {data.recargo != null && data.recargo > 0 && (
                <div style={{ fontSize: 12, color: '#c05000', marginTop: 2 }}>
                  + Recargo por atraso: <strong>{formatCurrency(data.recargo)}</strong>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Total Pagado</div>
              <div style={{ fontSize: 26, fontWeight: 'bold', color: '#2d7a2d' }}>{formatCurrency(totalPagado)}</div>
            </div>
          </div>
        </div>

        {/* Saldo pendiente */}
        {data.saldo != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', background: '#fff8f0', border: '1px solid #f0c080', borderRadius: 4, padding: '8px 14px' }}>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>Saldo Pendiente Restante</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#c05000' }}>{formatCurrency(data.saldo)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Comentario */}
      {data.comentario && (
        <div style={{ marginBottom: 14, background: '#f5f5f5', borderRadius: 4, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Observaciones</div>
          <div style={{ fontSize: 12, color: '#444' }}>{data.comentario}</div>
        </div>
      )}

      {/* Firmas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 40, paddingTop: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: 6 }}>
            <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Firma del Cliente
            </div>
            <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{data.clienteNombre || ''}</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: 6 }}>
            <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Sello y Firma Empresa
            </div>
            <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Ruiz Inmobiliaria</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 10, color: '#aaa', borderTop: '1px solid #e0e0e0', paddingTop: 10 }}>
        Este documento es un comprobante de pago válido emitido por Ruiz Inmobiliaria.
        {' '}Generado el {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}.
      </div>
    </div>
  )

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-3xl bg-white rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <h3 className="text-lg font-semibold text-gray-900">Vista Previa del Recibo</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#504840] text-white rounded-md text-sm font-medium hover:bg-[#3d3630] transition-colors"
              >
                <Printer size={16} />
                Imprimir / Descargar PDF
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Receipt Preview */}
          <div className="p-6 bg-gray-100 overflow-auto">
            <div ref={printRef}>
              {receiptContent}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
