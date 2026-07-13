import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabaseClient'
import { getCached, setCached, invalidateCache } from '@/lib/queryCache'
import type { CuentaBancaria, Desarrollo } from '@/types/database'
import { Edit2, Plus, Trash2, RefreshCw } from 'lucide-react'

type CuentaFormState = {
  nombre: string
  banco: string
  numero_cuenta: string
  clabe: string
  desarrolloid: string
  activa: boolean
}

const emptyForm: CuentaFormState = {
  nombre: '',
  banco: '',
  numero_cuenta: '',
  clabe: '',
  desarrolloid: '',
  activa: true,
}

export const CuentasBancarias = () => {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [desarrollos, setDesarrollos] = useState<Desarrollo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editing, setEditing] = useState<CuentaBancaria | null>(null)
  const [form, setForm] = useState<CuentaFormState>(emptyForm)

  const loadData = async (bypass = false) => {
    const ck = 'cuentas:all'
    if (!bypass) {
      const c = getCached<{ cuentas: CuentaBancaria[]; desarrollos: Desarrollo[] }>(ck)
      if (c) { setCuentas(c.cuentas); setDesarrollos(c.desarrollos); setLoading(false); return }
    }
    setLoading(true)
    try {
      const [cuentasRes, desarrollosRes] = await Promise.all([
        supabase
          .from('cuentas_bancarias')
          .select('cuenta_bancaria_id, nombre, banco, numero_cuenta, clabe, desarrolloid, activa')
          .order('nombre', { ascending: true }),
        supabase
          .from('desarrollo')
          .select('desarrolloid, nombre, clavedesarrollo, estatus')
          .order('nombre', { ascending: true }),
      ])

      if (cuentasRes.error) throw cuentasRes.error
      if (desarrollosRes.error) throw desarrollosRes.error

      setCuentas((cuentasRes.data || []) as CuentaBancaria[])
      setDesarrollos((desarrollosRes.data || []) as Desarrollo[])
      setCached('cuentas:all', { cuentas: (cuentasRes.data || []) as CuentaBancaria[], desarrollos: (desarrollosRes.data || []) as Desarrollo[] })
    } catch (error) {
      console.error('Error cargando cuentas bancarias:', error)
      setCuentas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return cuentas
    return cuentas.filter((c) => {
      const desarrollo = desarrollos.find((d) => d.desarrolloid === c.desarrolloid)
      return [c.nombre, c.banco ?? '', c.numero_cuenta ?? '', c.clabe ?? '', desarrollo?.nombre ?? '', desarrollo?.clavedesarrollo ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [cuentas, search, desarrollos])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (cuenta: CuentaBancaria) => {
    setEditing(cuenta)
    setForm({
      nombre: cuenta.nombre ?? '',
      banco: cuenta.banco ?? '',
      numero_cuenta: cuenta.numero_cuenta ?? '',
      clabe: cuenta.clabe ?? '',
      desarrolloid: cuenta.desarrolloid != null ? String(cuenta.desarrolloid) : '',
      activa: !!cuenta.activa,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) return alert('El nombre de la cuenta es requerido')

    setIsSubmitting(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        banco: form.banco.trim() || null,
        numero_cuenta: form.numero_cuenta.trim() || null,
        clabe: form.clabe.trim() || null,
        desarrolloid: form.desarrolloid ? Number(form.desarrolloid) : null,
        activa: form.activa,
      }

      const result = editing
        ? await supabase.from('cuentas_bancarias').update(payload).eq('cuenta_bancaria_id', editing.cuenta_bancaria_id)
        : await supabase.from('cuentas_bancarias').insert(payload)

      if (result.error) throw result.error

      setShowModal(false)
      setEditing(null)
      setForm(emptyForm)
      invalidateCache('cuentas:')
      await loadData(true)
    } catch (error: any) {
      alert(`Error guardando cuenta: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (cuenta: CuentaBancaria) => {
    const ok = window.confirm(`Eliminar la cuenta "${cuenta.nombre}"? Los pagos relacionados quedarán sin cuenta vinculada.`)
    if (!ok) return

    try {
      setIsSubmitting(true)
      const { error } = await supabase.from('cuentas_bancarias').delete().eq('cuenta_bancaria_id', cuenta.cuenta_bancaria_id)
      if (error) throw error
      invalidateCache('cuentas:')
      await loadData(true)
    } catch (error: any) {
      alert(`Error eliminando cuenta: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-black" style={{ fontFamily: 'Playfair Display, serif' }}>
              Cuentas Bancarias
            </h1>
            <p className="text-[#9e9f92] mt-2">Catálogo de cuentas para pagos por transferencia</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { invalidateCache('cuentas:'); loadData(true) }} className="inline-flex items-center gap-2">
              <RefreshCw size={16} /> Recargar
            </Button>
            <Button onClick={openCreate} className="inline-flex items-center gap-2">
              <Plus size={16} /> Nueva Cuenta
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border-t-4 border-[#504840] p-6 mb-6">
          <label className="block text-sm font-medium text-black mb-1">Buscar</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, banco, cuenta o desarrollo..." />
        </div>

        <DataTable<CuentaBancaria>
          data={filtered}
          loading={loading}
          emptyMessage="No hay cuentas bancarias registradas"
          columns={[
            {
              key: 'nombre',
              label: 'Nombre',
              render: (row) => <span className="font-semibold text-gray-900">{row.nombre}</span>,
            },
            {
              key: 'banco',
              label: 'Banco',
              render: (row) => row.banco ?? '—',
            },
            {
              key: 'numero_cuenta',
              label: 'Cuenta',
              render: (row) => row.numero_cuenta ? `****${row.numero_cuenta.slice(-4)}` : '—',
            },
            {
              key: 'clabe',
              label: 'CLABE',
              render: (row) => row.clabe ?? '—',
            },
            {
              key: 'desarrolloid',
              label: 'Desarrollo',
              render: (row) => {
                const desarrollo = desarrollos.find((d) => d.desarrolloid === row.desarrolloid)
                return desarrollo ? `${desarrollo.nombre ?? '—'} (${desarrollo.clavedesarrollo ?? '—'})` : 'General'
              },
            },
            {
              key: 'activa',
              label: 'Estado',
              render: (row) => (
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${row.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {row.activa ? 'Activa' : 'Inactiva'}
                </span>
              ),
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row) => (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(row)} className="inline-flex items-center gap-1">
                    <Edit2 size={14} />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(row)} className="inline-flex items-center gap-1">
                    <Trash2 size={14} />
                  </Button>
                </div>
              ),
            },
          ]}
        />

        <Modal
          isOpen={showModal}
          title={editing ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
          onClose={() => !isSubmitting && setShowModal(false)}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Nombre *</label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Cuenta principal financiera" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Banco</label>
                <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="BBVA / Banorte / etc." />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">Desarrollo</label>
                <select
                  value={form.desarrolloid}
                  onChange={(e) => setForm({ ...form, desarrolloid: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
                >
                  <option value="">General</option>
                  {desarrollos.map((d) => (
                    <option key={d.desarrolloid} value={d.desarrolloid}>
                      {d.nombre} ({d.clavedesarrollo})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Número de cuenta</label>
                <Input value={form.numero_cuenta} onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })} placeholder="1234567890" />
              </div>
              <div>
                <label className="block text-sm font-medium text-black mb-1">CLABE</label>
                <Input value={form.clabe} onChange={(e) => setForm({ ...form, clabe: e.target.value })} placeholder="18 dígitos" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input id="activa" type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
              <label htmlFor="activa" className="text-sm text-gray-700">Cuenta activa</label>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button variant="outline" type="button" onClick={() => setShowModal(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  )
}