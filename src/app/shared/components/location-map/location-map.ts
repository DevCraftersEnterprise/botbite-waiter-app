import { HttpClient } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/** Sin punto ni referencia, el mapa muestra México completo. */
const MEXICO: L.LatLngTuple = [23.6, -102.5];
const MEXICO_ZOOM = 5;
const POINT_ZOOM = 16;

/** Buscador de direcciones de OpenStreetMap. Su uso gratis pide pocas consultas: solo al dar Enter. */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Punto de Leaflet con un ícono de CSS: no depende de las imágenes del paquete. */
const pointIcon = (className: string) =>
  L.divIcon({
    className: '',
    html: `<span class="${className}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

/**
 * Mapa de OpenStreetMap para marcar un punto con un clic (decisión 6 de
 * "Ajustes del portal"). El punto se puede arrastrar, y el círculo muestra el
 * radio. No guarda nada: emite el punto y el formulario lo pone en sus
 * coordenadas.
 */
@Component({
  selector: 'app-location-map',
  template: `
    <div class="space-y-2">
      <form class="flex gap-2" (submit)="$event.preventDefault(); search()">
        <input
          class="input"
          type="search"
          [attr.aria-label]="'Buscar una dirección en el mapa de ' + label()"
          placeholder="Buscar una dirección o colonia"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
        <button type="submit" class="btn-small shrink-0" [disabled]="searching() || !query().trim()">
          {{ searching() ? 'Buscando…' : 'Buscar' }}
        </button>
      </form>
      @if (searchMessage(); as message) {
        <p class="text-xs text-neutral-600" role="status">{{ message }}</p>
      }
      <div
        #map
        class="h-64 w-full overflow-hidden rounded-xl border border-black/10"
        role="application"
        [attr.aria-label]="'Mapa de ' + label() + ': haz clic para marcar el punto'"
        [attr.data-testid]="testId()"
      ></div>
      <p class="text-xs text-neutral-500">
        Haz clic en el mapa para marcar el punto, o arrastra el punto para ajustarlo.
      </p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationMapComponent {
  private readonly http = inject(HttpClient);

  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  /** Dibuja un círculo con este radio alrededor del punto. */
  readonly radiusMeters = input<number | null>(null);
  /** Un punto fijo de referencia (por ejemplo, la sucursal en el mapa de una zona). */
  readonly reference = input<MapPoint | null>(null);
  /** Para el texto de accesibilidad: "la sucursal", "la zona 1"… */
  readonly label = input('la ubicación');
  readonly testId = input<string | null>(null);
  readonly pointChange = output<MapPoint>();

  protected readonly query = signal('');
  protected readonly searching = signal(false);
  protected readonly searchMessage = signal<string | null>(null);

  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private circle: L.Circle | null = null;
  private referenceMarker: L.Marker | null = null;

  constructor() {
    afterNextRender(() => this.createMap());

    // Lo que se escribe en las coordenadas o el radio se ve en el mapa.
    effect(() => {
      const point = this.point();
      const radius = this.radiusMeters();
      const reference = this.reference();
      untracked(() => this.draw(point, radius, reference));
    });

    inject(DestroyRef).onDestroy(() => {
      this.map?.remove();
      this.map = null;
    });
  }

  private point(): MapPoint | null {
    const latitude = this.latitude();
    const longitude = this.longitude();
    return latitude == null || longitude == null ? null : { latitude, longitude };
  }

  private createMap(): void {
    const start = this.point() ?? this.reference();
    this.map = L.map(this.mapElement().nativeElement, {
      center: start ? [start.latitude, start.longitude] : MEXICO,
      zoom: start ? POINT_ZOOM : MEXICO_ZOOM,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => this.choose(event.latlng));

    // En un modal, el mapa se crea antes de que termine de medir su tamaño.
    setTimeout(() => this.map?.invalidateSize(), 150);
    this.draw(this.point(), this.radiusMeters(), this.reference());
  }

  private choose(latlng: L.LatLng): void {
    const point = {
      latitude: Number(latlng.lat.toFixed(6)),
      longitude: Number(latlng.lng.toFixed(6)),
    };
    this.draw(point, this.radiusMeters(), this.reference());
    this.pointChange.emit(point);
  }

  private draw(point: MapPoint | null, radius: number | null, reference: MapPoint | null): void {
    const map = this.map;
    if (!map) return;

    if (reference) {
      const at: L.LatLngTuple = [reference.latitude, reference.longitude];
      this.referenceMarker ??= L.marker(at, {
        icon: pointIcon('map-point map-point-reference'),
        interactive: false,
        keyboard: false,
      }).addTo(map);
      this.referenceMarker.setLatLng(at);
    } else {
      this.referenceMarker?.remove();
      this.referenceMarker = null;
    }

    if (!point) {
      this.marker?.remove();
      this.circle?.remove();
      this.marker = null;
      this.circle = null;
      return;
    }

    const at: L.LatLngTuple = [point.latitude, point.longitude];
    if (!this.marker) {
      this.marker = L.marker(at, {
        icon: pointIcon('map-point'),
        draggable: true,
        keyboard: false,
        title: 'Punto marcado',
      }).addTo(map);
      this.marker.on('dragend', () => {
        const moved = this.marker?.getLatLng();
        if (moved) this.choose(moved);
      });
    } else {
      this.marker.setLatLng(at);
    }

    if (radius && radius > 0) {
      this.circle ??= L.circle(at, { radius, color: '#111', weight: 1, fillOpacity: 0.12 }).addTo(map);
      this.circle.setLatLng(at);
      this.circle.setRadius(radius);
    } else {
      this.circle?.remove();
      this.circle = null;
    }

    if (!map.getBounds().contains(at)) map.setView(at, Math.max(map.getZoom(), POINT_ZOOM));
  }

  /** Lleva el mapa a la dirección buscada. El punto se marca con un clic. */
  protected search(): void {
    const q = this.query().trim();
    if (!q || this.searching()) return;

    this.searching.set(true);
    this.searchMessage.set(null);

    this.http
      .get<NominatimResult[]>(NOMINATIM_URL, {
        params: { q, format: 'jsonv2', limit: 1, countrycodes: 'mx', 'accept-language': 'es' },
      })
      .subscribe({
        next: ([result]) => {
          this.searching.set(false);
          if (!result) {
            this.searchMessage.set('No se encontró esa dirección. Prueba con la colonia o la ciudad.');
            return;
          }
          this.map?.setView([Number(result.lat), Number(result.lon)], POINT_ZOOM + 1);
          this.searchMessage.set(`Mapa en: ${result.display_name}. Haz clic para marcar el punto.`);
        },
        error: () => {
          this.searching.set(false);
          this.searchMessage.set('No se pudo buscar. Mueve el mapa a mano o pega las coordenadas.');
        },
      });
  }
}
