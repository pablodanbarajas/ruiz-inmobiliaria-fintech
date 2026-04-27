/**
 * Tipos canónicos de desarrollos inmobiliarios.
 * PublicDevelopment: datos visibles para cualquier visitante.
 * Development: objeto completo usado internamente.
 */

export interface PublicDevelopment {
  id: string;
  name: string;
  imageUrl: string;
  availableLots: number;
  location: string;
  /** URL de Google Maps u otro proveedor de mapas */
  mapsUrl: string;
  /** true si existe un mapa interactivo de lotes para este desarrollo */
  hasInteractiveMap?: boolean;
}

export type Development = PublicDevelopment;
