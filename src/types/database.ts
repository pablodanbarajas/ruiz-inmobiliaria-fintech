// Custom types for application
export type User = {
  id: string
  email?: string
  nombre?: string
  apellido?: string
}

export type Cliente = {
  clienteid: number
  nombre: string | null
  sexo: string | null
  email: string | null
  claveelector: string | null
  calle: string | null
  numeroext: string | null
  numeroint: string | null
  codigopostal: string | null
  colonia: string | null
  municipio_ciudad: string | null
  estado: string | null
  pais: string | null
  domiciliocobro: string | null
  estadocivil: string | null
  regimenmatrimonial: string | null
  nombreconyuge: string | null
  beneficiarios: string | null
  telefonocelular: string | null
  telefono2: string | null
  estatus: string | null
  comentarios: string | null
  curp: string | null
  rfc: string | null
  municipio_ciudad_nacimiento: string | null
  estado_nacimiento: string | null
  pais_nacimiento: string | null
}

export type Desarrollo = {
  desarrolloid: number
  clavedesarrollo: string | null
  nombre: string | null
  descripcion: string | null
  descripciondetallada: string | null
  estatus: string | null
  tipodesarrolloid: number | null
  montominimoapartado: string | null
  enganche: string | null
  tipodesarrollo?: TipoDesarrollo
}

export type TipoDesarrollo = {
  tipodesarrolloid: number
  descripcion: string | null
}

export type Lote = {
  loteid: number
  desarrolloid: number | null
  duenioid: number | null
  clavedesarrollo: string | null
  coto: string | null
  manzana: string | null
  nolote: string | null
  clavelote: string | null
  tipolote: string | null
  linderonte: number | null
  colindanciante: string | null
  linderosur: number | null
  colindanciasur: string | null
  linderoote: number | null
  colindanciaote: string | null
  linderopte: number | null
  colindanciapte: string | null
  superficie: number | null
  preciopormt2: number | null
  preciolote: number | null
  estatus: string | null
  comentarios: string | null
  desarrollo?: Desarrollo
  duenio?: Duenio
}

export type Duenio = {
  duenioid: number
  nombre: string | null
  contacto: string | null
}

export type Venta = {
  ventaid: number
  loteid: number | null
  clienteid: number | null
  fecha: string | null
  preciolote: number | null
  enganche: number | null
  plazo: number | null
  fechaprimeramensualidad: string | null
  estatus: string | null
  usuarioid: string | null
}

export type CorridaFinanciera = {
  corridafinancieraid: number
  ventaid: number | null
  nopago: number | null
  fecha: string | null
  saldo: number | null
  mensualidad: number | null
}

export type Pago = {
  pagoid: number
  corridafinancieraid: number | null
  fechapago: string | null
  montopagado: number | null
  formapago: number | null
  estatus: string | null
}
