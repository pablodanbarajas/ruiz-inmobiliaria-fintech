import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

// Titular Sustituto and Beneficiarios that the Valle de Flores Carátula prints (Cláusula Décima).

type Rol = 'sustituto' | 'beneficiario'
type Campo = 'nombre' | 'domicilio' | 'telefono' | 'email' | 'parentesco'
type Persona = Record<Campo, string>

const PUESTOS: { rol: Rol; orden: number; titulo: string }[] = [
  { rol: 'sustituto', orden: 1, titulo: 'Titular sustituto' },
  { rol: 'beneficiario', orden: 1, titulo: 'Beneficiario 1 · primer orden' },
  { rol: 'beneficiario', orden: 2, titulo: 'Beneficiario 2 · segundo orden' },
]

const CAMPOS: { campo: Campo; etiqueta: string; type?: string }[] = [
  { campo: 'nombre', etiqueta: 'Nombre completo' },
  { campo: 'parentesco', etiqueta: 'Parentesco' },
  { campo: 'telefono', etiqueta: 'Teléfono', type: 'tel' },
  { campo: 'email', etiqueta: 'Correo electrónico', type: 'email' },
  { campo: 'domicilio', etiqueta: 'Domicilio' },
]

const vacia = (): Persona => ({ nombre: '', domicilio: '', telefono: '', email: '', parentesco: '' })
const clave = (rol: Rol, orden: number) => `${rol}-${orden}`
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const DesignadosContrato = ({ ventaid }: { ventaid: number }) => {
  const [personas, setPersonas] = useState<Record<string, Persona>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    let activo = true
    const cargar = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('venta_designado')
        .select('rol, orden, nombre, domicilio, telefono, email, parentesco')
        .eq('ventaid', ventaid)
      if (!activo) return
      if (error) {
        setMensaje({ tipo: 'error', texto: 'No se pudieron cargar el sustituto y los beneficiarios.' })
      } else {
        const inicial: Record<string, Persona> = {}
        for (const fila of data || []) {
          inicial[clave(fila.rol, fila.orden)] = {
            nombre: fila.nombre || '',
            domicilio: fila.domicilio || '',
            telefono: fila.telefono || '',
            email: fila.email || '',
            parentesco: fila.parentesco || '',
          }
        }
        setPersonas(inicial)
      }
      setLoading(false)
    }
    cargar()
    return () => {
      activo = false
    }
  }, [ventaid])

  const actualizar = (llave: string, campo: Campo, valor: string) => {
    setMensaje(null)
    setPersonas((actual) => ({ ...actual, [llave]: { ...(actual[llave] ?? vacia()), [campo]: valor } }))
  }

  const guardar = async () => {
    const llenos = PUESTOS.map((puesto) => ({ ...puesto, persona: personas[clave(puesto.rol, puesto.orden)] ?? vacia() }))
    const conDatos = llenos.filter(({ persona }) => Object.values(persona).some((valor) => valor.trim()))

    const sinNombre = conDatos.find(({ persona }) => !persona.nombre.trim())
    if (sinNombre) {
      setMensaje({ tipo: 'error', texto: `Falta el nombre de: ${sinNombre.titulo}.` })
      return
    }
    const correoInvalido = conDatos.find(({ persona }) => persona.email.trim() && !EMAIL_VALIDO.test(persona.email.trim()))
    if (correoInvalido) {
      setMensaje({ tipo: 'error', texto: `El correo de ${correoInvalido.titulo} no es válido.` })
      return
    }

    setSaving(true)
    setMensaje(null)
    try {
      const filas = conDatos.map(({ rol, orden, persona }) => ({
        ventaid,
        rol,
        orden,
        nombre: persona.nombre.trim(),
        domicilio: persona.domicilio.trim() || null,
        telefono: persona.telefono.trim() || null,
        email: persona.email.trim().toLowerCase() || null,
        parentesco: persona.parentesco.trim() || null,
        updated_at: new Date().toISOString(),
      }))
      if (filas.length) {
        const { error } = await supabase.from('venta_designado').upsert(filas, { onConflict: 'ventaid,rol,orden' })
        if (error) throw error
      }

      // A block left empty removes that designation.
      const vaciados = llenos.filter((puesto) => !conDatos.includes(puesto))
      for (const { rol, orden } of vaciados) {
        const { error } = await supabase.from('venta_designado').delete().match({ ventaid, rol, orden })
        if (error) throw error
      }
      setMensaje({ tipo: 'ok', texto: 'Guardado. El contrato ya toma estos datos.' })
    } catch (error) {
      console.error('Error saving designados:', error)
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar. Inténtalo de nuevo.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-[20px] border border-[#e0e5e7] overflow-hidden mb-8">
      <div className="px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Users size={18} className="text-[#504840]" />
          <div>
            <h2 className="text-base font-bold text-gray-900">Sustituto y beneficiarios</h2>
            <p className="text-xs text-gray-500">Aparecen en la carátula del contrato. Son opcionales.</p>
          </div>
        </div>
        <Button onClick={guardar} disabled={loading || saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`px-4 md:px-8 pt-3 text-sm ${mensaje.tipo === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {mensaje.texto}
        </p>
      )}

      {loading ? (
        <div className="p-4 md:px-8 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 p-4 md:px-8 md:py-5 lg:grid-cols-3">
          {PUESTOS.map(({ rol, orden, titulo }) => {
            const llave = clave(rol, orden)
            const persona = personas[llave] ?? vacia()
            return (
              <fieldset key={llave} className="space-y-3">
                <legend className="text-sm font-semibold text-gray-900 mb-1">{titulo}</legend>
                {CAMPOS.map(({ campo, etiqueta, type }) => (
                  <label key={campo} className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">{etiqueta}</span>
                    <Input
                      type={type ?? 'text'}
                      value={persona[campo]}
                      onChange={(e) => actualizar(llave, campo, e.target.value)}
                    />
                  </label>
                ))}
              </fieldset>
            )
          })}
        </div>
      )}
    </div>
  )
}
