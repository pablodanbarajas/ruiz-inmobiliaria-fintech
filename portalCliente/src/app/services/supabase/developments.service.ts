import { publicSupabase } from './publicClient';
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
    const ORDER = [11, 20];

    const { data, error } = await publicSupabase
      .from('public_developments')
      .select('*')
      .in('id', ALLOWED_IDS);

    if (error) {
      throw new Error(`Error al obtener desarrollos: ${error.message}`);
    }

    return ((data ?? []) as SupabaseDevelopmentRow[])
      .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
      .map((row) => ({
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