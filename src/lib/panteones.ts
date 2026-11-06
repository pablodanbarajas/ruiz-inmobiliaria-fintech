import { supabase } from '@/lib/supabaseClient'
import { DEMO_DESARROLLOIDS } from '@/config/demoMode'

/** IDs of the enabled cemetery developments. Their figures are reported apart from Inmobiliaria Ruiz. */
export const fetchPanteonesDesarrolloIds = async (): Promise<number[]> => {
  const { data: types, error: typesError } = await supabase
    .from('tipodesarrollo')
    .select('tipodesarrolloid')
    .ilike('descripcion', '%panteon%')
  if (typesError) throw typesError

  const typeIds = (types || []).map((type) => type.tipodesarrolloid)
  const { data: developments, error: developmentsError } = await supabase
    .from('desarrollo')
    .select('desarrolloid')
    .or(
      typeIds.length
        ? `tipodesarrolloid.in.(${typeIds.join(',')}),nombre.ilike.*valle*flores*`
        : 'nombre.ilike.*valle*flores*'
    )
    .in('desarrolloid', DEMO_DESARROLLOIDS)
  if (developmentsError) throw developmentsError

  return (developments || []).map((development) => development.desarrolloid)
}
