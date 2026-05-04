import { supabase } from './client';
import type { IDevelopmentsService } from '../interfaces';
import type { PublicDevelopment } from '../../types/development.types';

type SupabaseDevelopmentRow = {
  id: number;
  name: string;
  description: string;
  location: string;
  available_lots: number;
  image_url: string;
  google_maps_url: string;
  min_apartado: number | null;
  enganche: number | null;
};

export const supabaseDevelopmentsService: IDevelopmentsService = {
  async getPublicDevelopments(): Promise<PublicDevelopment[]> {
    const ALLOWED_IDS = [11, 20]; // Pueblos de la Barranca, Desarrollo de Prueba

    const { data, error } = await supabase
      .from('public_developments')
      .select('*')
      .in('id', ALLOWED_IDS)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener desarrollos: ${error.message}`);
    }

    return ((data ?? []) as SupabaseDevelopmentRow[]).map((row) => ({
      id: String(row.id),
      name: row.name,
      location: row.location || 'Ubicación pendiente',
      availableLots: row.available_lots ?? 0,
      imageUrl: row.image_url || '',
      mapsUrl: (row.google_maps_url && row.google_maps_url !== '#') ? row.google_maps_url : '',
      minApartado: row.min_apartado ?? undefined,
      enganche: row.enganche ?? undefined,
      hasInteractiveMap: row.id === 11
    }));
  }
};