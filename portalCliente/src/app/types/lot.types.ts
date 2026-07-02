/**
 * Tipos canónicos de lotes.
 * ClientLot: datos privados del lote asignado a un cliente autenticado.
 * MapLot: datos públicos para el mapa interactivo (sin información financiera).
 */

export type LotStatus = 'apartado' | 'apartado_confirmado' | 'en_formalizacion' | 'en_pagos' | 'finalizado';

/** Datos del próximo pago asociado a un lote */
export interface LotNextPayment {
  amount: number;
  dueDate: string;
  paymentType: string;
}

/** Seguimiento del avance de compra del lote */
export interface LotProgress {
  currentStage: number;
  stages: string[];
}

/**
 * Lote asignado a un cliente.
 * Solo accesible por el cliente propietario.
 */
export interface ClientLot {
  id: string;
  /** Clave alfanumérica visible del lote, ej: "06-042" */
  key: string;
  ventaid: string;
  developmentId: string;
  developmentName: string;
  location: string;
  /** Superficie en m², ej: "200 m²" */
  surface: string;
  price: number;
  imageUrl: string;
  status: LotStatus;
  nextPayment?: LotNextPayment;
  progress: LotProgress;
}

/**
 * Representación pública de un lote para el mapa interactivo.
 * No contiene información financiera ni datos del cliente.
 * Preparado para integración futura con el visor de lotes.
 */
export interface MapLot {
  id: string;
  key: string;
  developmentId: string;
  status: 'disponible' | 'apartado' | 'vendido';
  surface: string;
  /** Precio base de lista (solo si aplica mostrar en mapa público) */
  basePrice?: number;
  /** Coordenadas o posición en el plano del desarrollo */
  position?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
}
