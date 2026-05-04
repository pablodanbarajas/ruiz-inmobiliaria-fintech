/**
 * Tipos canónicos de desarrollos inmobiliarios.
 * PublicDevelopment: datos visibles para cualquier visitante.
 */

export interface PublicDevelopment {
  id: string;
  name: string;
  imageUrl: string;
  availableLots: number;
  location: string;
  /** URL de Google Maps u otro proveedor de mapas */
  mapsUrl: string;
  /** Monto mínimo de apartado en MXN */
  minApartado?: number;
  /**
   * true cuando este desarrollo tiene mapa interactivo de lotes activo.
   * Solo el primer desarrollo (Pueblo de Barrancas) lo tiene por ahora.
   */
  hasInteractiveMap?: boolean;
}

export type Development = PublicDevelopment;
