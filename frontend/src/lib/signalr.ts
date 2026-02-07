import { HubConnectionBuilder, HubConnection, LogLevel, HubConnectionState } from '@microsoft/signalr';

const HUB_URL = 'http://localhost:5001/hubs/notifications';

let connection: HubConnection | null = null;

/**
 * Returns a singleton SignalR connection.
 * Token is read lazily from localStorage on every connect/reconnect.
 */
export function getConnection(): HubConnection {
  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => localStorage.getItem('tradyx_token') || '',
      })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000]) // retry intervals
      .configureLogging(LogLevel.Information)
      .build();
  }
  return connection;
}

export async function startConnection(): Promise<void> {
  const conn = getConnection();
  if (conn.state === HubConnectionState.Connected || conn.state === HubConnectionState.Connecting) return;
  try {
    await conn.start();
    console.log('[SignalR] Connected');
  } catch (err) {
    console.error('[SignalR] Connection failed, retrying in 5s...', err);
    setTimeout(startConnection, 5000);
  }
}

export async function stopConnection(): Promise<void> {
  if (connection && connection.state === HubConnectionState.Connected) {
    await connection.stop();
    console.log('[SignalR] Disconnected');
  }
}

export { HubConnectionState };
