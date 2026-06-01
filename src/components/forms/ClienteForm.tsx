import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Cliente } from '@/types/database'

interface ClienteFormProps {
  cliente?: Cliente | null
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export const ClienteForm = ({ cliente, onSubmit, isLoading = false }: ClienteFormProps) => {
  const [formData, setFormData] = useState({
    nombre: '',
    sexo: '',
    email: '',
    claveelector: '',
    calle: '',
    numeroext: '',
    numeroint: '',
    codigopostal: '',
    colonia: '',
    municipio_ciudad: '',
    estado: '',
    pais: '',
    domiciliocobro: '',
    estadocivil: '',
    regimenmatrimonial: '',
    nombreconyuge: '',
    beneficiarios: '',
    telefonocelular: '',
    telefono2: '',
    estatus: 'A',
    comentarios: '',
    curp: '',
    rfc: '',
    municipio_ciudad_nacimiento: '',
    estado_nacimiento: '',
    pais_nacimiento: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (cliente) {
      setFormData({
        nombre: cliente.nombre || '',
        sexo: cliente.sexo || '',
        email: cliente.email || '',
        claveelector: cliente.claveelector || '',
        calle: cliente.calle || '',
        numeroext: cliente.numeroext || '',
        numeroint: cliente.numeroint || '',
        codigopostal: cliente.codigopostal || '',
        colonia: cliente.colonia || '',
        municipio_ciudad: cliente.municipio_ciudad || '',
        estado: cliente.estado || '',
        pais: cliente.pais || '',
        domiciliocobro: cliente.domiciliocobro || '',
        estadocivil: cliente.estadocivil || '',
        regimenmatrimonial: cliente.regimenmatrimonial || '',
        nombreconyuge: cliente.nombreconyuge || '',
        beneficiarios: cliente.beneficiarios || '',
        telefonocelular: cliente.telefonocelular || '',
        telefono2: cliente.telefono2 || '',
        estatus: cliente.estatus || 'A',
        comentarios: cliente.comentarios || '',
        curp: cliente.curp || '',
        rfc: cliente.rfc || '',
        municipio_ciudad_nacimiento: cliente.municipio_ciudad_nacimiento || '',
        estado_nacimiento: cliente.estado_nacimiento || '',
        pais_nacimiento: cliente.pais_nacimiento || '',
      })
    }
  }, [cliente])

  const validateForm = async () => {
    const newErrors: Record<string, string> = {}

    // Validaciones básicas
    if (!formData.nombre.trim()) newErrors.nombre = 'Nombre requerido'
    if (!formData.email.trim()) newErrors.email = 'Email requerido'
    if (!formData.rfc.trim()) newErrors.rfc = 'RFC requerido'
    if (!formData.curp.trim()) newErrors.curp = 'CURP requerido'
    if (!formData.telefonocelular.trim()) newErrors.telefonocelular = 'Teléfono celular requerido'

    // Validación de email
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }

    // Validación de RFC (12–13 caracteres alfanuméricos)
    if (formData.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3}$/.test(formData.rfc.toUpperCase().trim())) {
      newErrors.rfc = 'RFC inválido (ej: XAXX000101000)'
    }

    // Validación de CURP (18 caracteres: 4 letras + 6 dígitos + H/M + 5 letras + 2 alfanum.)
    if (formData.curp && !/^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]{2}$/.test(formData.curp.toUpperCase().trim())) {
      newErrors.curp = 'CURP inválido (18 caracteres, ej: XAXX000101HXXXXX01)'
    }

    // Validación de unicidad si es creación o cambio de RFC/CURP/Email
    if (!cliente) {
      // Creación: siempre validar unicidad
      const { data: existingRfc } = await supabase
        .from('cliente')
        .select('clienteid')
        .eq('rfc', formData.rfc.toUpperCase().trim())
        .single()

      const { data: existingCurp } = await supabase
        .from('cliente')
        .select('clienteid')
        .eq('curp', formData.curp.toUpperCase().trim())
        .single()

      const { data: existingEmail } = await supabase
        .from('cliente')
        .select('clienteid')
        .eq('email', formData.email.toLowerCase().trim())
        .single()

      if (existingRfc) newErrors.rfc = 'RFC ya existe en la base de datos'
      if (existingCurp) newErrors.curp = 'CURP ya existe en la base de datos'
      if (existingEmail) newErrors.email = 'Email ya existe en la base de datos'
    } else {
      // Edición: validar solo si cambiaron
      if (formData.rfc.toUpperCase().trim() !== cliente.rfc?.toUpperCase().trim()) {
        const { data: existingRfc } = await supabase
          .from('cliente')
          .select('clienteid')
          .eq('rfc', formData.rfc.toUpperCase().trim())
          .single()
        if (existingRfc) newErrors.rfc = 'RFC ya existe en la base de datos'
      }

      if (formData.curp.toUpperCase().trim() !== cliente.curp?.toUpperCase().trim()) {
        const { data: existingCurp } = await supabase
          .from('cliente')
          .select('clienteid')
          .eq('curp', formData.curp.toUpperCase().trim())
          .single()
        if (existingCurp) newErrors.curp = 'CURP ya existe en la base de datos'
      }

      if (formData.email.toLowerCase().trim() !== cliente.email?.toLowerCase().trim()) {
        const { data: existingEmail } = await supabase
          .from('cliente')
          .select('clienteid')
          .eq('email', formData.email.toLowerCase().trim())
          .single()
        if (existingEmail) newErrors.email = 'Email ya existe en la base de datos'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isValid = await validateForm()
    if (!isValid) return

    try {
      const submitData = {
        nombre: formData.nombre.trim(),
        sexo: formData.sexo.trim(),
        email: formData.email.toLowerCase().trim(),
        claveelector: formData.claveelector.trim(),
        calle: formData.calle.trim(),
        numeroext: formData.numeroext.trim(),
        numeroint: formData.numeroint.trim(),
        codigopostal: formData.codigopostal.trim(),
        colonia: formData.colonia.trim(),
        municipio_ciudad: formData.municipio_ciudad.trim(),
        estado: formData.estado.trim(),
        pais: formData.pais.trim(),
        domiciliocobro: formData.domiciliocobro.trim(),
        estadocivil: formData.estadocivil.trim(),
        regimenmatrimonial: formData.regimenmatrimonial.trim(),
        nombreconyuge: formData.nombreconyuge.trim(),
        beneficiarios: formData.beneficiarios.trim(),
        telefonocelular: formData.telefonocelular.trim(),
        telefono2: formData.telefono2.trim(),
        estatus: formData.estatus.trim(),
        comentarios: formData.comentarios.trim(),
        curp: formData.curp.toUpperCase().trim(),
        rfc: formData.rfc.toUpperCase().trim(),
        municipio_ciudad_nacimiento: formData.municipio_ciudad_nacimiento.trim(),
        estado_nacimiento: formData.estado_nacimiento.trim(),
        pais_nacimiento: formData.pais_nacimiento.trim(),
      }
      await onSubmit(submitData)
    } catch (error) {
      console.error('Error submitting form:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información General */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información General</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <Input
              type="text"
              placeholder="Nombre completo"
              value={formData.nombre}
              onChange={(e) => handleChange('nombre', e.target.value)}
              className={errors.nombre ? 'border-red-500' : ''}
            />
            {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
            <select
              value={formData.sexo}
              onChange={(e) => handleChange('sexo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
            >
              <option value="">Seleccionar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado Civil</label>
            <select
              value={formData.estadocivil}
              onChange={(e) => handleChange('estadocivil', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
            >
              <option value="">Seleccionar</option>
              <option value="Soltero">Soltero</option>
              <option value="Casado">Casado</option>
              <option value="Divorciado">Divorciado</option>
              <option value="Viudo">Viudo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.estatus}
              onChange={(e) => handleChange('estatus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
            >
              <option value="A">Activo</option>
              <option value="I">Inactivo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datos Fiscales */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Fiscales</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RFC *</label>
            <Input
              type="text"
              placeholder="RFC"
              value={formData.rfc}
              onChange={(e) => handleChange('rfc', e.target.value.toUpperCase())}
              className={errors.rfc ? 'border-red-500' : ''}
            />
            {errors.rfc && <p className="text-red-500 text-sm mt-1">{errors.rfc}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CURP *</label>
            <Input
              type="text"
              placeholder="CURP"
              value={formData.curp}
              onChange={(e) => handleChange('curp', e.target.value.toUpperCase())}
              className={errors.curp ? 'border-red-500' : ''}
            />
            {errors.curp && <p className="text-red-500 text-sm mt-1">{errors.curp}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clave Elector</label>
            <Input
              type="text"
              placeholder="Clave elector"
              value={formData.claveelector}
              onChange={(e) => handleChange('claveelector', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Contacto */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contacto</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <Input
              type="email"
              placeholder="email@ejemplo.com"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono Celular *</label>
            <Input
              type="tel"
              placeholder="Teléfono"
              value={formData.telefonocelular}
              onChange={(e) => handleChange('telefonocelular', e.target.value)}
              className={errors.telefonocelular ? 'border-red-500' : ''}
            />
            {errors.telefonocelular && <p className="text-red-500 text-sm mt-1">{errors.telefonocelular}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono 2</label>
            <Input
              type="tel"
              placeholder="Teléfono secundario"
              value={formData.telefono2}
              onChange={(e) => handleChange('telefono2', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Domicilio */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Domicilio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Calle</label>
            <Input
              type="text"
              placeholder="Nombre de la calle"
              value={formData.calle}
              onChange={(e) => handleChange('calle', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. Exterior</label>
            <Input
              type="text"
              placeholder="No. Ext"
              value={formData.numeroext}
              onChange={(e) => handleChange('numeroext', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. Interior</label>
            <Input
              type="text"
              placeholder="No. Int / Apto"
              value={formData.numeroint}
              onChange={(e) => handleChange('numeroint', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Colonia</label>
            <Input
              type="text"
              placeholder="Colonia"
              value={formData.colonia}
              onChange={(e) => handleChange('colonia', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal</label>
            <Input
              type="text"
              placeholder="CP"
              value={formData.codigopostal}
              onChange={(e) => handleChange('codigopostal', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipio/Ciudad</label>
            <Input
              type="text"
              placeholder="Municipio"
              value={formData.municipio_ciudad}
              onChange={(e) => handleChange('municipio_ciudad', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <Input
              type="text"
              placeholder="Estado"
              value={formData.estado}
              onChange={(e) => handleChange('estado', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
            <Input
              type="text"
              placeholder="País"
              value={formData.pais}
              onChange={(e) => handleChange('pais', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Domicilio de Cobro (si es diferente)</label>
            <Input
              type="text"
              placeholder="Domicilio alternativo"
              value={formData.domiciliocobro}
              onChange={(e) => handleChange('domiciliocobro', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Información Matrimonial */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Matrimonial</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Régimen Matrimonial</label>
            <select
              value={formData.regimenmatrimonial}
              onChange={(e) => handleChange('regimenmatrimonial', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
            >
              <option value="">Seleccionar</option>
              <option value="Separación de bienes">Separación de bienes</option>
              <option value="Sociedad conyugal">Sociedad conyugal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cónyuge</label>
            <Input
              type="text"
              placeholder="Nombre del cónyuge"
              value={formData.nombreconyuge}
              onChange={(e) => handleChange('nombreconyuge', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Lugar de Nacimiento */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Lugar de Nacimiento</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipio/Ciudad</label>
            <Input
              type="text"
              placeholder="Municipio"
              value={formData.municipio_ciudad_nacimiento}
              onChange={(e) => handleChange('municipio_ciudad_nacimiento', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <Input
              type="text"
              placeholder="Estado"
              value={formData.estado_nacimiento}
              onChange={(e) => handleChange('estado_nacimiento', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
            <Input
              type="text"
              placeholder="País"
              value={formData.pais_nacimiento}
              onChange={(e) => handleChange('pais_nacimiento', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Información Adicional */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Adicional</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiarios</label>
            <Input
              type="text"
              placeholder="Beneficiarios"
              value={formData.beneficiarios}
              onChange={(e) => handleChange('beneficiarios', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
            <textarea
              placeholder="Observaciones adicionales"
              value={formData.comentarios}
              onChange={(e) => handleChange('comentarios', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#eaae4c]"
              rows={4}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 justify-end pt-6 border-t">
        <Button type="submit" disabled={isLoading} className="bg-[#eaae4c] hover:bg-[#d99c38] text-black font-semibold py-2 px-6">
          {isLoading ? 'Guardando...' : cliente ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}
