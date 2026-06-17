import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { lotsService, paymentsService } from '../services';
import type { ClientLot } from '../types/lot.types';
import type { PaymentSummary } from '../types/payment.types';

interface DataContextValue {
  lots: ClientLot[];
  lotsLoading: boolean;
  paymentSummary: PaymentSummary | null;
  paymentsLoading: boolean;
  refreshLots: () => void;
  refreshPayments: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const [lots, setLots] = useState<ClientLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsLoaded, setLotsLoaded] = useState(false);

  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);

  const loadLots = useCallback((force = false) => {
    if (!session.user) return;
    if (lotsLoaded && !force) return;
    setLotsLoading(true);
    lotsService
      .getClientLots(session.user.id)
      .then((data) => { setLots(data); setLotsLoaded(true); })
      .finally(() => setLotsLoading(false));
  }, [session.user, lotsLoaded]);

  const loadPayments = useCallback((force = false) => {
    if (!session.user) return;
    if (paymentsLoaded && !force) return;
    setPaymentsLoading(true);
    paymentsService
      .getClientPayments(session.user.id)
      .then((data) => { setPaymentSummary(data); setPaymentsLoaded(true); })
      .finally(() => setPaymentsLoading(false));
  }, [session.user, paymentsLoaded]);

  // Cargar datos en cuanto el usuario esté disponible
  useEffect(() => {
    if (!session.user) return;
    loadLots();
    loadPayments();
  }, [session.user]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshLots = useCallback(() => {
    setLotsLoaded(false);
    loadLots(true);
  }, [loadLots]);

  const refreshPayments = useCallback(() => {
    setPaymentsLoaded(false);
    loadPayments(true);
  }, [loadPayments]);

  return (
    <DataContext.Provider value={{ lots, lotsLoading, paymentSummary, paymentsLoading, refreshLots, refreshPayments }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
