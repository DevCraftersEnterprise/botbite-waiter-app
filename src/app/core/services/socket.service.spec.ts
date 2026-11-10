import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { OFFLINE_AFTER_MS, POLL_EVERY_MS, SOCKET_FACTORY, SocketService } from './socket.service';

type Handler = (...args: unknown[]) => void;

/** Lo mínimo de un socket de socket.io para la prueba. */
class FakeSocket {
  connected = false;
  active = true;
  connectCalls = 0;
  emitted: [string, unknown][] = [];
  options: { auth?: (cb: (data: object) => void) => void; reconnectionAttempts?: number } = {};
  private readonly handlers = new Map<string, Handler[]>();

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  emit(event: string, arg: unknown) {
    this.emitted.push([event, arg]);
    return this;
  }

  connect() {
    this.connectCalls += 1;
    this.active = true;
    return this;
  }

  disconnect() {
    this.connected = false;
    this.active = false;
    return this;
  }

  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((handler) => handler(...args));
  }

  /** La API acepta la conexión. */
  accept() {
    this.connected = true;
    this.fire('connect');
  }

  /** Se corta la conexión. */
  drop(reason = 'transport close') {
    this.connected = false;
    this.fire('disconnect', reason);
  }

  joins() {
    return this.emitted.filter(([event]) => event === 'joinBranch').length;
  }
}

describe('SocketService', () => {
  const api = environment.apiBaseUrl;
  let fake: FakeSocket;
  let auth: { accessToken: string | null; renewAccessToken: jasmine.Spy };
  let backend: HttpTestingController;

  /** Deja correr las promesas pendientes (la renovación del token). */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

  const create = () => {
    const service = TestBed.inject(SocketService);
    const resyncs: number[] = [];
    service.getResyncs().subscribe(() => resyncs.push(Date.now()));
    return { service, resyncs };
  };

  beforeEach(() => {
    fake = new FakeSocket();
    auth = { accessToken: 'access-1', renewAccessToken: jasmine.createSpy('renewAccessToken') };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        {
          provide: SOCKET_FACTORY,
          useValue: (_url: string, options: FakeSocket['options']) => {
            fake.options = options;
            return fake as unknown as Socket;
          },
        },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    backend.verify();
  });

  it('retries forever and sends the latest access token on every attempt', () => {
    create();
    expect(fake.options.reconnectionAttempts).toBe(Infinity);

    auth.accessToken = 'access-2';
    let sent: object | undefined;
    fake.options.auth?.((data) => (sent = data));
    expect(sent).toEqual({ token: 'access-2' });
  });

  it('warns after 10 seconds without connection and clears the warning on connect', () => {
    jasmine.clock().install();
    const { service } = create();

    jasmine.clock().tick(OFFLINE_AFTER_MS - 1);
    expect(service.offline()).toBeFalse();
    jasmine.clock().tick(1);
    expect(service.offline()).toBeTrue();

    fake.accept();
    expect(service.offline()).toBeFalse();
  });

  it('does not warn about a short outage', () => {
    jasmine.clock().install();
    const { service } = create();
    fake.accept();

    fake.drop();
    jasmine.clock().tick(OFFLINE_AFTER_MS - 1);
    fake.accept();
    jasmine.clock().tick(OFFLINE_AFTER_MS);

    expect(service.offline()).toBeFalse();
  });

  it('rejoins the branch and reloads the screens after reconnecting (#27)', () => {
    const { service, resyncs } = create();
    const orderUpdates: string[] = [];
    service.getOrderUpdates().subscribe((update) => orderUpdates.push(update.branchId));

    fake.accept();
    service.joinBranch('b1');
    expect(resyncs.length).toBe(0); // La primera conexión no recarga: la pantalla ya cargó.

    fake.drop();
    fake.accept();

    expect(fake.joins()).toBe(2);
    expect(resyncs.length).toBe(1);
    expect(orderUpdates).toEqual(['b1']);
  });

  it('reconnects when the API closes the connection itself', () => {
    create();
    fake.accept();

    fake.drop('io server disconnect');

    expect(fake.connectCalls).toBe(1);
  });

  it('stays quiet when the panel closes the connection', () => {
    jasmine.clock().install();
    const { service } = create();
    fake.accept();

    service.disconnect();
    fake.fire('disconnect', 'io client disconnect');
    jasmine.clock().tick(OFFLINE_AFTER_MS);

    expect(service.offline()).toBeFalse();
    expect(fake.connectCalls).toBe(0);
  });

  it('renews the session and reconnects when the API rejects the token (#27)', async () => {
    create();
    auth.renewAccessToken.and.resolveTo('access-2');
    fake.options.auth?.(() => undefined); // El intento salió con access-1.

    fake.active = false;
    fake.fire('connect_error', new Error('Unauthorized'));
    await settle();

    expect(auth.renewAccessToken).toHaveBeenCalledOnceWith('access-1');
    expect(fake.connectCalls).toBe(1);
  });

  it('does not renew while socket.io is still retrying on its own', async () => {
    create();

    fake.fire('connect_error', new Error('xhr poll error'));
    await settle();

    expect(auth.renewAccessToken).not.toHaveBeenCalled();
  });

  it('stops when the session is gone', async () => {
    create();
    auth.renewAccessToken.and.resolveTo(null);

    fake.active = false;
    fake.fire('connect_error', new Error('Unauthorized'));
    await settle();

    expect(fake.connectCalls).toBe(0);
  });

  it('checks the API every 30 seconds while offline and reloads when it answers', () => {
    jasmine.clock().install();
    const { resyncs } = create();
    fake.active = false; // socket.io dejó de intentar.

    jasmine.clock().tick(OFFLINE_AFTER_MS + POLL_EVERY_MS);
    backend.expectOne(`${api}/health`).flush({ status: 'ok' });

    expect(resyncs.length).toBe(1);
    expect(fake.connectCalls).toBe(1);

    // Si la API no contesta, no hay nada que recargar.
    jasmine.clock().tick(POLL_EVERY_MS);
    backend
      .expectOne(`${api}/health`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    expect(resyncs.length).toBe(1);
  });
});
