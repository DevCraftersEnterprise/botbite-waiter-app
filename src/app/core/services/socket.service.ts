import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CashierNotification {
  id: string;
  message: string;
  phoneNumber?: string;
  branchId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  customer?: {
    id: string;
    name: string;
    phone: string;
  };
}

export interface NotificationUpdate {
  branchId: string;
  notification: CashierNotification;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private orderUpdateSubject = new Subject<{ branchId: string }>();
  private notificationSubject = new Subject<NotificationUpdate>();
  // Sala a la que hay que volver a unirse tras una reconexión (el servidor
  // olvida las salas al desconectarse).
  private currentBranchId: string | null = null;

  constructor() {
    this.connect();
  }

  private connect(): void {
    // Extraer el host base de la URL de la API
    const apiUrl = environment.apiBaseUrl.replace('/v1', '');

    this.socket = io(`${apiUrl}/orders`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // La API exige el access token. Se lee en cada intento para usar siempre
      // el más reciente (el interceptor lo renueva al expirar).
      auth: (cb) => cb({ token: localStorage.getItem('botbite.access') ?? '' }),
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      if (this.currentBranchId) {
        this.socket?.emit('joinBranch', this.currentBranchId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('orderUpdate', (data: { branchId: string }) => {
      this.orderUpdateSubject.next(data);
    });

    this.socket.on('notificationUpdate', (data: NotificationUpdate) => {
      this.notificationSubject.next(data);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  getOrderUpdates(): Observable<{ branchId: string }> {
    return this.orderUpdateSubject.asObservable();
  }

  getNotificationUpdates(): Observable<NotificationUpdate> {
    return this.notificationSubject.asObservable();
  }

  joinBranch(branchId: string): void {
    this.currentBranchId = branchId;

    if (!this.socket) {
      this.connect();
      return; // Se une a la sala al conectar.
    }

    if (!this.socket.connected) {
      // Si el socket se creó antes del login o agotó sus reintentos, se vuelve
      // a conectar ahora que hay token; se une a la sala en 'connect'.
      this.socket.connect();
      return;
    }

    this.socket.emit('joinBranch', branchId);
    console.log(`Joined branch room: ${branchId}`);
  }

  leaveBranch(branchId: string): void {
    if (this.currentBranchId === branchId) this.currentBranchId = null;

    if (this.socket) {
      this.socket.emit('leaveBranch', branchId);
      console.log(`Left branch room: ${branchId}`);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
