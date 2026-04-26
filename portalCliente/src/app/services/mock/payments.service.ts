import type { IPaymentsService } from '../interfaces';
import type { PaymentSummary } from '../../types/payment.types';
import { mockPendingPayments, mockCompletedPayments } from '../../data/mock/payments.mock';

export const mockPaymentsService: IPaymentsService = {
  async getClientPayments(_clientId: string): Promise<PaymentSummary> {
    // Mock: devuelve todos los pagos ignorando clientId.
    // La implementación real usará RLS en Supabase para filtrar por usuario.
    return {
      pendingPayments: mockPendingPayments,
      completedPayments: mockCompletedPayments
    };
  }
};
