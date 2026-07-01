// Yandex Maps JS API 2.1 loader.
// Loads the API script dynamically (Next.js can't import external URLs).
// In Yandex Maps 2.1, coordinates are [latitude, longitude].

// Minimal type declarations for the ymaps global
interface YMapsPlacemarkOptions {
  iconLayout?: string;
  iconImageHref?: string;
  iconImageSize?: [number, number];
  iconImageOffset?: [number, number];
  iconShape?: { type: string; coordinates: [number, number]; radius?: number };
  preset?: string;
  zIndex?: number;
  hideIconOnBalloonOpen?: boolean;
  balloonContentLayout?: string;
  balloonPanelContentLayout?: string;
}

interface YMapsPolylineOptions {
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  lineCap?: string;
  lineJoin?: string;
}

interface YMapsMapOptions {
  center: [number, number];
  zoom: number;
  controls?: string[];
  behaviors?: string[];
  type?: string;
  restrictMapArea?: boolean | [[number, number], [number, number]];
}

interface YMapsMap {
  geoObjects: {
    add(obj: unknown): this;
    remove(obj: unknown): this;
    removeAll(): this;
  };
  setCenter(center: [number, number], zoom?: number, options?: { duration?: number; checkZoomRange?: boolean; flying?: boolean }): Promise<void>;
  setZoom(zoom: number, options?: { duration?: number; checkZoomRange?: boolean }): Promise<void>;
  getCenter(): [number, number];
  getZoom(): number;
  panTo(center: [number, number] | [number, number][], options?: { duration?: number; delay?: number; flying?: boolean; safe?: boolean }): Promise<void>;
  destroy(): void;
  setType(type: string): this;
  controls: {
    add(control: unknown, options?: { position?: unknown }): this;
    remove(control: unknown): this;
  };
  events: {
    add(type: string, callback: (...args: unknown[]) => void): this;
    remove(type: string, callback: (...args: unknown[]) => void): this;
  };
  bounds: {
    getBounds(): [[number, number], [number, number]];
  };
  setBounds(bounds: [[number, number], [number, number]], options?: { checkZoomRange?: boolean; duration?: number; zoomMargin?: number | number[] }): Promise<void>;
  container: {
    fitToViewport(): void;
  };
}

interface YMapsAPI {
  ready: (cb?: () => void) => Promise<void>;
  Map: new (container: HTMLElement | string, state: YMapsMapOptions, options?: Record<string, unknown>) => YMapsMap;
  Placemark: new (coords: [number, number], properties?: Record<string, unknown>, options?: YMapsPlacemarkOptions) => unknown;
  Polyline: new (coords: [number, number][], properties?: Record<string, unknown>, options?: YMapsPolylineOptions) => unknown;
  Circle: new (coords: [number, number], radius: number, properties?: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
  GeoObjectCollection: new (features?: unknown[], options?: Record<string, unknown>) => unknown;
  templateLayoutFactory: {
    createClass(template: string, options?: Record<string, unknown>): unknown;
  };
  coordSystem: {
    geo: { getDistance(point1: [number, number], point2: [number, number]): number };
  };
  util: {
    bounds: {
      fromPoints(points: [number, number][]): [[number, number], [number, number]];
    };
  };
  geocode: (request: string | [number, number], options?: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Window {
    ymaps?: YMapsAPI;
  }
}

let ymapsPromise: Promise<YMapsAPI> | null = null;

/**
 * Load Yandex Maps JS API 2.1.
 * Works with or without an API key (without key shows a console notice but still loads).
 */
export function loadYandexMaps(apiKey?: string): Promise<YMapsAPI> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps can only be loaded in browser"));
  }

  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    });
  }

  if (ymapsPromise) return ymapsPromise;

  ymapsPromise = new Promise((resolve, reject) => {
    const params = new URLSearchParams({ lang: "ru_RU" });
    if (apiKey) params.set("apikey", apiKey);
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?${params.toString()}`;
    script.async = true;
    script.onload = () => {
      if (window.ymaps) {
        const ym = window.ymaps;
        ym.ready(() => resolve(ym));
      } else {
        reject(new Error("Yandex Maps failed to load"));
      }
    };
    script.onerror = () => reject(new Error("Yandex Maps script load error"));
    document.head.appendChild(script);
  });

  return ymapsPromise;
}

// Tashkent center [lat, lng]
export const TASHKENT_CENTER: [number, number] = [41.31218, 69.25138];

// Tashkent bounding box [[sw_lat, sw_lng], [ne_lat, ne_lng]]
export const TASHKENT_BOUNDS: [[number, number], [number, number]] = [
  [41.15, 69.05],
  [41.45, 69.45],
];

/**
 * Create an SVG data URI for a colored circle marker
 */
export function createCircleSvg(color: string, size: number, strokeWidth = 2.5): string {
  const r = (size - strokeWidth) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}" stroke="white" stroke-width="${strokeWidth}"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Create an SVG data URI for the driver marker (amber circle with truck icon)
 */
export function createDriverSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="#C2700F" stroke="white" stroke-width="2.5"/>
    <text x="18" y="25" text-anchor="middle" font-size="18">🚛</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}