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
}

export type Development = PublicDevelopment;
