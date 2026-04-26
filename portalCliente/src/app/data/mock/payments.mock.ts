import type { Payment } from '../../types/payment.types';

export const mockPendingPayments: Payment[] = [
  {
    id: 'pay-1',
    date: '2026-03-22',
    reason: 'Apartado - Lote 06-042',
    amount: 2000,
    status: 'atrasado',
    lotKey: '06-042'
  },
  {
    id: 'pay-2',
    date: '2026-03-25',
    reason: 'Mensualidad - Lote 03-123',
    amount: 2400,
    status: 'por_vencer',
    lotKey: '03-123'
  },
  {
    id: 'pay-3',
    date: '2026-03-28',
    reason: 'Enganche - Lote 05-056',
    amount: 15000,
    status: 'pendiente',
    lotKey: '05-056'
  },
  {
    id: 'pay-4',
    date: '2026-04-10',
    reason: 'Mensualidad - Lote 03-123',
    amount: 2400,
    status: 'pendiente',
    lotKey: '03-123'
  }
];

export const mockCompletedPayments: Payment[] = [
  {
    id: 'pay-5',
    date: '2026-02-20',
    reason: 'Mensualidad - Lote 03-123',
    amount: 2400,
    status: 'pagado',
    lotKey: '03-123'
  },
  {
    id: 'pay-6',
    date: '2026-02-15',
    reason: 'Apartado - Lote 05-056',
    amount: 2000,
    status: 'pagado',
    lotKey: '05-056'
  },
  {
    id: 'pay-7',
    date: '2026-01-20',
    reason: 'Mensualidad - Lote 03-123',
    amount: 2400,
    status: 'pagado',
    lotKey: '03-123'
  },
  {
    id: 'pay-8',
    date: '2026-01-10',
    reason: 'Enganche - Lote 03-123',
    amount: 15000,
    status: 'pagado',
    lotKey: '03-123'
  }
];
