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
    const { data, error } = await supabase
      .from('public_developments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener desarrollos: ${error.message}`);
    }

    console.log('SUPABASE DEVELOPMENTS:', data);

    return ((data ?? []) as SupabaseDevelopmentRow[]).map((row) => ({
      id: String(row.id),
      name: row.name,
      location: row.location || 'Ubicación pendiente',
      availableLots: row.available_lots ?? 0,
      image: row.image_url || '',
      googleMapsUrl: row.google_maps_url || '#',
      hasInteractiveMap: row.id === 11
    }));
  }
};