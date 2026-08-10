import { WebSocketServer, WebSocket } from 'ws';
import { supabaseAdmin } from '../lib/supabase.js';
import jwt from 'jsonwebtoken';

export function setupRealtimeWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: '/api/realtime' });

  // Map to store connected clients by user ID
  const clients = new Map<string, WebSocket[]>();

  wss.on('connection', (ws, req) => {
    let userId: string | null = null;
    let userRole: string | null = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth') {
          const token = data.token;
          const decoded = jwt.decode(token) as any;
          if (decoded && decoded.sub) {
            userId = decoded.sub;
            userRole = decoded.role || 'student_faculty';
          }

          if (userId) {
            if (!clients.has(userId)) {
              clients.set(userId, []);
            }
            clients.get(userId)!.push(ws);
            ws.send(JSON.stringify({ type: 'auth_success' }));
          } else {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
          }
        }
      } catch (err) {
        console.error('WS Message Error:', err);
      }
    });

    ws.on('close', () => {
      if (userId && clients.has(userId)) {
        const userClients = clients.get(userId)!;
        const index = userClients.indexOf(ws);
        if (index > -1) {
          userClients.splice(index, 1);
        }
        if (userClients.length === 0) {
          clients.delete(userId);
        }
      }
    });
  });

  // Listen to Supabase Realtime
  try {
    const channel = supabaseAdmin.channel('backend_alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_alerts' },
        (payload) => {
          const record = payload.new as any;
          if (!record) return;

          clients.forEach((userClients, uId) => {
            const msg = JSON.stringify({
              type: 'sos_update',
              payload: record
            });
            userClients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
              }
            });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_reports' },
        (payload) => {
          const record = payload.new as any;
          if (!record) return;

          clients.forEach((userClients, uId) => {
            const msg = JSON.stringify({
              type: 'incident_update',
              payload: record
            });
            userClients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
              }
            });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const record = payload.new as any;
          if (!record) return;

          // Only send to the specific user who owns the notification
          const userId = record.user_id;
          if (userId && clients.has(userId)) {
            const msg = JSON.stringify({
              type: 'notification_update',
              payload: record
            });
            const userClients = clients.get(userId)!;
            userClients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_audit_logs' },
        (payload) => {
          const record = payload.new as any;
          if (!record) return;

          clients.forEach((userClients, uId) => {
            const msg = JSON.stringify({
              type: 'audit_log_update',
              payload: record
            });
            userClients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
              }
            });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scheduler_logs' },
        (payload) => {
          const record = payload.new as any;
          if (!record) return;

          clients.forEach((userClients, uId) => {
            const msg = JSON.stringify({
              type: 'scheduler_log_update',
              payload: record
            });
            userClients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
              }
            });
          });
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Realtime subscription error:', err);
  }

  console.log('[CampusCare Backend] WebSocket Server initialized on /api/realtime');
}
