import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken, OnDestroy, signal } from '@angular/core';
import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { merge, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { logError } from './error-log';

export type NotificationType = 'order' | 'bill' | 'pay_with_waiter' | 'payment' | 'alert' | 'invoice';

export interface CashierNotification {
  id: string;
  type: NotificationType;
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

/** Crea el socket. Las pruebas lo cambian por uno falso. */
export const SOCKET_FACTORY = new InjectionToken<
  (url: string, options: Partial<ManagerOptions & SocketOptions>) => Socket
>('SOCKET_FACTORY', { providedIn: 'root', factory: () => io });

/** Sin conexión por más de este tiempo, la barra de arriba avisa (decisión 9). */
export const OFFLINE_AFTER_MS = 10_000;

/** Mientras no hay conexión en vivo, cada cuánto se consulta la API. */
export const POLL_EVERY_MS = 30_000;

/**
 * Si la API rechaza el token varias veces seguidas aunque se renueve, se espera
 * a la siguiente consulta en lugar de reintentar de inmediato.
 */
const MAX_QUICK_AUTH_RETRIES = 3;

@Injectable({
  providedIn: 'root',
})
export class SocketService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly createSocket = inject(SOCKET_FACTORY);

  private socket: Socket | null = null;
  private readonly orderUpdateSubject = new Subject<{ branchId: string }>();
  private readonly notificationSubject = new Subject<NotificationUpdate>();
  private readonly resyncSubject = new Subject<void>();
  // Sala a la que hay que volver a unirse tras una reconexión (el servidor
  // olvida las salas al desconectarse).
  private currentBranchId: string | null = null;

  /** La conexión en vivo lleva más de 10 segundos caída. */
  readonly offline = signal(false);

  private hasConnected = false;
  /** El access token con el que se intentó conectar la última vez. */
  private handshakeToken = '';
  private renewing = false;
  private authRetries = 0;
  private offlineTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.connect();
    this.auth.sessionEnded.subscribe(() => this.endSession());
  }

  /**
   * Al cerrar sesión, la conexión era del usuario anterior y seguía en la sala
   * de su sucursal (issue #40). Se cierra y se olvida la sala: el siguiente
   * `joinBranch` abre otra con el token del usuario nuevo.
   */
  private endSession(): void {
    this.currentBranchId = null;
    this.hasConnected = false;
    this.authRetries = 0;
    this.disconnect();
  }

  private connect(): void {
    // Extraer el host base de la URL de la API
    const apiUrl = environment.apiBaseUrl.replace('/v1', '');

    this.socket = this.createSocket(`${apiUrl}/orders`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      // Sin límite: caja deja la pantalla abierta horas y la red se puede cortar.
      reconnectionAttempts: Infinity,
      // La API exige el access token. Se lee en cada intento para usar siempre
      // el más reciente.
      auth: (cb) => {
        this.handshakeToken = this.auth.accessToken ?? '';
        cb({ token: this.handshakeToken });
      },
    });

    this.socket.on('connect', () => this.onConnect());
    this.socket.on('disconnect', (reason) => this.onDisconnect(reason));
    this.socket.on('connect_error', (error) => this.onConnectError(error));

    this.socket.on('orderUpdate', (data: { branchId: string }) => {
      this.orderUpdateSubject.next(data);
    });

    this.socket.on('notificationUpdate', (data: NotificationUpdate) => {
      this.notificationSubject.next(data);
    });

    this.watchOffline();
  }

  /**
   * Cuándo recargar los pedidos: cuando cambian, al volver la conexión en vivo y
   * cada 30 segundos mientras no la hay, para no perder lo que pasó en el corte.
   */
  getOrderUpdates(): Observable<{ branchId: string }> {
    return merge(
      this.orderUpdateSubject,
      this.resyncSubject.pipe(map(() => ({ branchId: this.currentBranchId ?? '' })))
    );
  }

  getNotificationUpdates(): Observable<NotificationUpdate> {
    return this.notificationSubject.asObservable();
  }

  /**
   * Al volver la conexión en vivo y cada 30 segundos mientras no la hay. Los
   * avisos que llegaron en el corte no se repiten: hay que volver a pedirlos.
   */
  getResyncs(): Observable<void> {
    return this.resyncSubject.asObservable();
  }

  joinBranch(branchId: string): void {
    this.currentBranchId = branchId;

    if (!this.socket) {
      this.connect();
      return; // Se une a la sala al conectar.
    }

    if (!this.socket.connected) {
      // Si el socket se creó antes del login o la API rechazó su token, se
      // vuelve a conectar ahora que hay sesión; se une a la sala en 'connect'.
      if (!this.socket.active) this.socket.connect();
      return;
    }

    this.socket.emit('joinBranch', branchId);
  }

  leaveBranch(branchId: string): void {
    if (this.currentBranchId === branchId) this.currentBranchId = null;

    if (this.socket) {
      this.socket.emit('leaveBranch', branchId);
    }
  }

  disconnect(): void {
    this.stopWatching();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private onConnect(): void {
    // Si ya había conectado antes o se avisó del corte, pudo haber cambios que
    // no llegaron por el socket: las pantallas abiertas recargan.
    const missedUpdates = this.hasConnected || this.offline();
    this.hasConnected = true;
    this.authRetries = 0;
    this.stopWatching();

    if (this.currentBranchId) {
      this.socket?.emit('joinBranch', this.currentBranchId);
    }
    if (missedUpdates) this.resyncSubject.next();
  }

  private onDisconnect(reason: Socket.DisconnectReason): void {
    // Lo cerró el propio panel (al salir).
    if (reason === 'io client disconnect') return;

    this.watchOffline();
    // La API cerró la conexión (por ejemplo, al reiniciarse): socket.io no
    // reintenta solo en este caso.
    if (reason === 'io server disconnect') this.socket?.connect();
  }

  private onConnectError(error: Error): void {
    logError('WebSocket connection error:', error.message);
    this.watchOffline();

    // Con `active` en true, socket.io reintenta solo (la API no contesta). En
    // false, la API rechazó el token, casi siempre porque venció.
    if (!this.socket || this.socket.active) return;
    void this.reconnectWithFreshToken();
  }

  /** Renueva la sesión como lo hace el interceptor y vuelve a conectar. */
  private async reconnectWithFreshToken(): Promise<void> {
    if (this.renewing) return;
    this.renewing = true;

    try {
      const token = await this.auth.renewAccessToken(this.handshakeToken || null);
      // Sin sesión no hay a qué reconectar: el panel manda al login.
      if (!token) return;

      this.authRetries += 1;
      // Si la API sigue rechazando el token, se reintenta en la siguiente consulta.
      if (this.authRetries <= MAX_QUICK_AUTH_RETRIES) this.socket?.connect();
    } catch {
      // La API no contestó al renovar: se reintenta en la siguiente consulta.
    } finally {
      this.renewing = false;
    }
  }

  /** A los 10 segundos sin conexión, avisa y empieza a consultar cada 30. */
  private watchOffline(): void {
    if (this.offlineTimer || this.offline()) return;

    this.offlineTimer = setTimeout(() => {
      this.offlineTimer = null;
      this.offline.set(true);
      this.pollTimer = setInterval(() => this.poll(), POLL_EVERY_MS);
    }, OFFLINE_AFTER_MS);
  }

  private stopWatching(): void {
    if (this.offlineTimer) clearTimeout(this.offlineTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.offlineTimer = null;
    this.pollTimer = null;
    this.offline.set(false);
  }

  /**
   * Si la API contesta, las pantallas recargan y, si socket.io dejó de
   * intentar, se vuelve a conectar. Si no contesta, no hay nada que recargar.
   */
  private poll(): void {
    this.http.get(`${environment.apiBaseUrl}/health`).subscribe({
      next: () => {
        this.resyncSubject.next();
        if (this.socket && !this.socket.active && !this.renewing) {
          this.authRetries = 0;
          this.socket.connect();
        }
      },
      error: () => undefined,
    });
  }
}
