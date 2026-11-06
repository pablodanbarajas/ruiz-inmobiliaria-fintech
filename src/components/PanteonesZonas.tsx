import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { fetchAllByKey } from '@/lib/fetchAllByKey'
import { formatCurrency } from '@/utils/helpers'

type Espacio = {
  loteid: number
  zona: string | null
  tipolote: string | null
  estatus: string | null
  preciolote: number | null
}

type ProductoResumen = {
  producto: string
  disponibles: number
  total: number
  precioDesde: number | null
}

type ZonaResumen = {
  zona: string
  disponibles: number
  productos: ProductoResumen[]
}

const summarizeByZone = (espacios: Espacio[]): ZonaResumen[] => {
  const zonas = new Map<string, { zona: string; productos: Map<string, ProductoResumen> }>()

  for (const espacio of espacios) {
    const zona = espacio.zona?.trim() || 'Sin zona'
    const zonaKey = zona.toLowerCase()
    const entry = zonas.get(zonaKey) ?? { zona, productos: new Map<string, ProductoResumen>() }
    zonas.set(zonaKey, entry)

    const producto = espacio.tipolote?.trim() || 'Sin producto'
    const resumen = entry.productos.get(producto) ?? { producto, disponibles: 0, total: 0, precioDesde: null }
    entry.productos.set(producto, resumen)

    resumen.total += 1
    if (espacio.estatus === 'D') {
      resumen.disponibles += 1
      const precio = Number(espacio.preciolote)
      if (precio > 0 && (resumen.precioDesde === null || precio < resumen.precioDesde)) {
        resumen.precioDesde = precio
      }
    }
  }

  return Array.from(zonas.values())
    .map(({ zona, productos }) => {
      const lista = Array.from(productos.values()).sort((a, b) => a.producto.localeCompare(b.producto))
      return { zona, productos: lista, disponibles: lista.reduce((sum, p) => sum + p.disponibles, 0) }
    })
    .sort((a, b) => a.zona.localeCompare(b.zona))
}

/** Commercial availability of a cemetery development, by zone and product. Never lists individual spaces. */
export const PanteonesZonas = ({ desarrolloId, nombre }: { desarrolloId: number; nombre: string }) => {
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let ignore = false

    fetchAllByKey<Espacio>(
      (afterKey, pageSize) =>
        supabase
          .from('lote')
          .select('loteid, zona, tipolote, estatus, preciolote')
          .eq('desarrolloid', desarrolloId)
          .gt('loteid', afterKey)
          .order('loteid', { ascending: true })
          .limit(pageSize),
      (espacio) => espacio.loteid,
    )
      .then((rows) => {
        if (!ignore) setEspacios(rows)
      })
      .catch((error) => {
        console.error('Error fetching zone availability:', error)
        if (!ignore) setLoadError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => { ignore = true }
  }, [desarrolloId])

  const zonas = useMemo(() => summarizeByZone(espacios), [espacios])

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="text-3xl font-bold text-gray-900">{nombre}</h1>
      <p className="mt-1 text-sm text-gray-500">Disponibilidad comercial por zona y producto</p>

      {loading && <p className="mt-6 text-sm text-gray-500">Cargando zonas…</p>}

      {loadError && (
        <div role="alert" className="mt-6 rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar la disponibilidad. Recarga la página para intentarlo de nuevo.
        </div>
      )}

      {!loading && !loadError && zonas.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">Este desarrollo todavía no tiene espacios registrados.</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {zonas.map((zona) => (
          <section key={zona.zona} className="rounded-[16px] border border-[#e0e5e7] bg-white p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{zona.zona}</h2>
              <p className={`text-sm font-medium ${zona.disponibles > 0 ? 'text-green-700' : 'text-gray-500'}`}>
                {zona.disponibles > 0 ? `${zona.disponibles} disponibles` : 'Sin disponibilidad'}
              </p>
            </div>
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 text-right font-medium">Disponibles</th>
                  <th className="pb-2 text-right font-medium">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zona.productos.map((producto) => (
                  <tr key={producto.producto}>
                    <td className="py-2 text-gray-900">{producto.producto}</td>
                    <td className="py-2 text-right text-gray-700">{producto.disponibles} de {producto.total}</td>
                    <td className="py-2 text-right text-gray-700">
                      {producto.precioDesde === null ? '—' : formatCurrency(producto.precioDesde)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  )
}
