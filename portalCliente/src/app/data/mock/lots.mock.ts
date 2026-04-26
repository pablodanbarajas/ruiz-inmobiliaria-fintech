import type { ClientLot } from '../../types/lot.types';

export const mockClientLots: ClientLot[] = [
  {
    id: 'lot-1',
    key: '06-042',
    developmentId: 'dev-1',
    developmentName: 'Pueblo de Barrancas',
    location: 'Tonalá, Jalisco',
    surface: '200 m²',
    price: 450000,
    imageUrl: 'https://images.unsplash.com/photo-1772325482422-55bc8dd65662?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZXJpYWwlMjByZXNpZGVudGlhbCUyMGRldmVsb3BtZW50JTIwbGFuZHxlbnwxfHx8fDE3NzM5ODkyMDB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'apartado',
    nextPayment: {
      amount: 2000,
      dueDate: '2026-03-22',
      paymentType: 'Apartado'
    },
    progress: {
      currentStage: 1,
      stages: ['Solicitud', 'Pago de apartado', 'Enganche', 'Mensualidades', 'Liquidado']
    }
  },
  {
    id: 'lot-2',
    key: '05-056',
    developmentId: 'dev-2',
    developmentName: 'Vistas del Cielo',
    location: 'Guadalajara, Jalisco',
    surface: '180 m²',
    price: 380000,
    imageUrl: 'https://images.unsplash.com/photo-1663540275466-f171aa6d9f3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZWlnaGJvcmhvb2QlMjBhZXJpYWwlMjBwaG90b2dyYXBoeXxlbnwxfHx8fDE3NzM5ODkyMDJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'apartado_confirmado',
    nextPayment: {
      amount: 15000,
      dueDate: '2026-03-28',
      paymentType: 'Enganche'
    },
    progress: {
      currentStage: 2,
      stages: ['Solicitud', 'Pago de apartado', 'Enganche', 'Mensualidades', 'Liquidado']
    }
  },
  {
    id: 'lot-3',
    key: '03-123',
    developmentId: 'dev-3',
    developmentName: 'Senderos de San Miguel',
    location: 'Tlajomulco, Jalisco',
    surface: '250 m²',
    price: 520000,
    imageUrl: 'https://images.unsplash.com/photo-1764222233275-87dc016c11dc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWFsJTIwZXN0YXRlJTIwbGFuZCUyMHBsb3R8ZW58MXx8fHwxNzczOTg5MjAxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'en_pagos',
    nextPayment: {
      amount: 2400,
      dueDate: '2026-03-25',
      paymentType: 'Mensualidad'
    },
    progress: {
      currentStage: 3,
      stages: ['Solicitud', 'Pago de apartado', 'Enganche', 'Mensualidades', 'Liquidado']
    }
  }
];
