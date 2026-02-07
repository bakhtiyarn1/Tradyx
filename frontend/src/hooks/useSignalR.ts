import { useEffect, useRef, useCallback } from 'react';
import { getConnection, startConnection, stopConnection, HubConnectionState } from '../lib/signalr';
import { useAuth } from '../lib/auth';

export interface SignalRCallbacks {
  onBalanceUpdated?: (newBalance: number) => void;
  onPayoutReceived?: (amount: number, description: string) => void;
  onNotificationReceived?: (message: string) => void;
  onInvestmentUpdated?: () => void;
  onTransactionCreated?: (type: string, amount: number) => void;
}

/**
 * React hook that manages the SignalR lifecycle.
 * Starts/stops the connection based on auth state.
 * Subscribes to strongly-typed hub events.
 */
export function useSignalR(callbacks: SignalRCallbacks = {}) {
  const { user } = useAuth();
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('tradyx_token');
    if (!token) return;

    const conn = getConnection();

    // Register event handlers
    const handlers = {
      BalanceUpdated: (newBalance: number) => cbRef.current.onBalanceUpdated?.(newBalance),
      PayoutReceived: (amount: number, description: string) => cbRef.current.onPayoutReceived?.(amount, description),
      NotificationReceived: (message: string) => cbRef.current.onNotificationReceived?.(message),
      InvestmentUpdated: () => cbRef.current.onInvestmentUpdated?.(),
      TransactionCreated: (type: string, amount: number) => cbRef.current.onTransactionCreated?.(type, amount),
    };

    // Clear any existing handlers to avoid duplicates on re-renders
    Object.keys(handlers).forEach(event => conn.off(event));
    Object.entries(handlers).forEach(([event, handler]) => conn.on(event, handler));

    // Connect
    startConnection();

    return () => {
      // Don't disconnect on unmount if other components share the connection,
      // but do clean up our handlers
      Object.keys(handlers).forEach(event => conn.off(event));
    };
  }, [user]);

  const isConnected = useCallback(() => {
    const conn = getConnection();
    return conn.state === HubConnectionState.Connected;
  }, []);

  return { isConnected, stopConnection };
}
