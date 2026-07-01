"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Navigation, NavigationOff, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadYandexMaps, createCircleSvg, createDriverSvg, TASHKENT_CENTER, type YMapsAPI } from "@/lib/yandex-maps";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: "pickup" | "dropoff" | "driver";
  label?: string;
}

export interface LiveMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  route?: [number, number][];
  className?: string;
  followDriver?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  interactive?: boolean;
  userPosition?: { lat: number; lng: number } | null;
  showMyLocationBtn?: boolean;
  onMyLocation?: () => void;
  geoLoading?: boolean;
  geoDenied?: boolean;
  isIpBased?: boolean;
  /** Increment this to force a re-center (e.g. when "My Location" tapped) */
  recenterTrigger?: number;
}

/**
 * LiveMap — Pure Yandex Maps 2.1 wrapper for YukTaxi.
 * Superior coverage in Uzbekistan: proper street names, building outlines, house numbers.
 */
export function LiveMap({
  center = TASHKENT_CENTER,
  zoom = 14,
  markers = [],
  route,
  className,
  followDriver,
  onMapClick,
  interactive = true,
  userPosition,
  showMyLocationBtn = false,
  onMyLocation,
  geoLoading = false,
  geoDenied = false,
  isIpBased = false,
  recenterTrigger = 0,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ymapsRef = useRef<YMapsAPI | null>(null);
  const mapRef = useRef<YMapsMap | null>(null);
  const userPlacemarkRef = useRef<unknown>(null);
  const userCircleRef = useRef<unknown>(null);
  const dataLayerRef = useRef<unknown>(null);
  const routeRef = useRef<unknown>(null);
  const initialCenterRef = useRef<[number, number] | null>(null);
  const hasPannedRef = useRef(false);
  const recenterRef = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync recenterTrigger
  useEffect(() => {
    if (recenterTrigger > recenterRef.current) {
      recenterRef.current = recenterTrigger;
      hasPannedRef.current = false; // allow re-pan
    }
  }, [recenterTrigger]);

  // Initialize Yandex Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || undefined;
    let destroyed = false;

    loadYandexMaps(apiKey)
      .then((ymaps) => {
        if (destroyed || !containerRef.current) return;

        ymapsRef.current = ymaps;

        const behaviors = interactive
          ? ["default", "scrollZoom"]
          : [];

        const map = new ymaps.Map(containerRef.current, {
          center: [...center] as [number, number],
          zoom,
          controls: [],
          behaviors,
          type: "yandex#map",
        }, {
          suppressMapOpenBlock: true,
        });

        // Add zoom control bottom-left
        try {
          const zoomCtrl = new (ymaps as unknown as Record<string, unknown>).control.ZoomControl({
            options: { size: "small", position: { bottom: 40, left: 10 } },
          });
          map.controls.add(zoomCtrl);
        } catch { /* zoom control optional */ }

        // Create data layer for markers + route
        const dataLayer = new ymaps.GeoObjectCollection();
        map.geoObjects.add(dataLayer);
        dataLayerRef.current = dataLayer;

        // Map click handler
        if (onMapClick) {
          map.events.add("click", (e: unknown) => {
            const evt = e as { get: (key: string) => number[] };
            const coords = evt.get("coords");
            onMapClick(coords[0], coords[1]);
          });
        }

        mapRef.current = map;
        initialCenterRef.current = [...center] as [number, number];

        setTimeout(() => {
          if (destroyed) return;
          map.container.fitToViewport();
          setMapReady(true);
        }, 300);
      })
      .catch(() => {
        if (!destroyed) setLoadError("LOAD_FAILED");
      });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      initialCenterRef.current = null;
      hasPannedRef.current = false;
      setMapReady(false);
      ymapsRef.current = null;
    };
    }, []);

  // React to center prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const shouldForce = recenterRef.current > 0 && !hasPannedRef.current;
    const init = initialCenterRef.current;

    // Skip if center is the same as initial (and not forced)
    if (!shouldForce && init) {
      if (
        Math.abs(center[0] - init[0]) < 0.001 &&
        Math.abs(center[1] - init[1]) < 0.001
      ) {
        return;
      }
    }

    // Skip if map is already very close
    const cur = map.getCenter();
    if (!shouldForce && cur) {
      if (
        Math.abs(cur[0] - center[0]) < 0.0005 &&
        Math.abs(cur[1] - center[1]) < 0.0005
      ) {
        return;
      }
    }

    map.setCenter([center[0], center[1]], zoom, { duration: 1200, flying: true });
    if (shouldForce) hasPannedRef.current = true;
  }, [center[0], center[1], zoom, mapReady, recenterTrigger]);

  // Update user position marker
  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps || !mapReady) return;

    if (userPlacemarkRef.current) {
      map.geoObjects.remove(userPlacemarkRef.current);
      userPlacemarkRef.current = null;
    }
    if (userCircleRef.current) {
      map.geoObjects.remove(userCircleRef.current);
      userCircleRef.current = null;
    }

    if (!userPosition) return;

    // Accuracy circle
    const radius = isIpBased ? 500 : 150;
    const circle = new ymaps.Circle(
      [[userPosition.lat, userPosition.lng], radius],
      {},
      {
        fillColor: "#3b82f610",
        strokeColor: "#3b82f640",
        strokeWidth: 1,
      }
    );
    map.geoObjects.add(circle);
    userCircleRef.current = circle;

    // User dot with pulse animation
    const userLayout = ymaps.templateLayoutFactory.createClass(
      `<div style="position:relative;width:20px;height:20px;">
        <div style="position:absolute;inset:-6px;border-radius:50%;background:#3b82f6;opacity:0.25;animation:yt-ymap-pulse 2s ease-out infinite;"></div>
        <div style="width:20px;height:20px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
      </div>`
    );

    const placemark = new ymaps.Placemark(
      [userPosition.lat, userPosition.lng],
      {},
      {
        iconLayout: userLayout,
        iconShape: { type: "Circle", coordinates: [0, 0], radius: 16 },
        zIndex: 1000,
        hideIconOnBalloonOpen: false,
      }
    );
    map.geoObjects.add(placemark);
    userPlacemarkRef.current = placemark;
  }, [userPosition, mapReady, isIpBased]);

  // Update data markers
  useEffect(() => {
    const ymaps = ymapsRef.current;
    const layer = dataLayerRef.current as ReturnType<YMapsAPI["GeoObjectCollection"]> | null;
    if (!ymaps || !layer || !mapReady) return;

    layer.removeAll();

    for (const m of markers) {
      let iconHref: string;
      let iconSize: [number, number];
      let offset: [number, number];

      if (m.kind === "driver") {
        iconHref = createDriverSvg();
        iconSize = [36, 36];
        offset = [-18, -18];
      } else if (m.kind === "pickup") {
        iconHref = createCircleSvg("#10b981", 16);
        iconSize = [16, 16];
        offset = [-8, -8];
      } else {
        iconHref = createCircleSvg("#C2700F", 16);
        iconSize = [16, 16];
        offset = [-8, -8];
      }

      const pm = new ymaps.Placemark(
        [m.lat, m.lng],
        {
          balloonContent: m.label || m.kind,
        },
        {
          iconLayout: "default#image",
          iconImageHref: iconHref,
          iconImageSize: iconSize,
          iconImageOffset: offset,
          zIndex: m.kind === "driver" ? 800 : 500,
          hideIconOnBalloonOpen: false,
        }
      );
      layer.add(pm);
    }

    if (followDriver && markers.length > 0) {
      const driver = markers.find((m) => m.kind === "driver") ?? markers[0];
      mapRef.current?.panTo([driver.lat, driver.lng], { duration: 800, flying: true });
    }
  }, [markers, followDriver, mapReady]);

  // Update route polyline
  useEffect(() => {
    const ymaps = ymapsRef.current;
    const layer = dataLayerRef.current as ReturnType<YMapsAPI["GeoObjectCollection"]> | null;
    const map = mapRef.current;
    if (!ymaps || !layer || !map || !mapReady) return;

    if (routeRef.current) {
      layer.remove(routeRef.current);
      routeRef.current = null;
    }

    if (!route || route.length < 2) return;

    const polyline = new ymaps.Polyline(route, {}, {
      strokeColor: "#C2700F",
      strokeWidth: 4,
      strokeOpacity: 0.8,
    });
    layer.add(polyline);
    routeRef.current = polyline;

    try {
      const bounds = ymaps.util.bounds.fromPoints(route);
      map.setBounds(bounds, { checkZoomRange: true, duration: 800, zoomMargin: [40, 40, 40, 40] });
    } catch {
      map.setCenter(route[0]);
    }
  }, [route, mapReady]);

  const handleMyLocation = useCallback(() => {
    onMyLocation?.();
  }, [onMyLocation]);

  // ---- Render ----

  if (loadError) {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/40 px-6 text-center", className)}>
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10">
          <MapPin className="h-7 w-7 text-destructive" />
        </div>
        <p className="text-[15px] font-bold text-foreground">Xarita yuklanmadi</p>
        <p className="text-[13px] text-muted-foreground">Internet aloqasini tekshiring</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={cn("h-full w-full", className)} style={{ minHeight: 200 }} />

      {!mapReady && !loadError && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-muted/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {showMyLocationBtn && mapReady && (
        <button
          onClick={handleMyLocation}
          disabled={geoLoading}
          className={cn(
            "absolute bottom-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition active:scale-90 dark:bg-zinc-800 dark:ring-white/10",
            geoLoading && "animate-pulse opacity-70",
            geoDenied && "bg-red-50 dark:bg-red-950/30"
          )}
          aria-label="My location"
        >
          {geoDenied ? (
            <NavigationOff className="h-5 w-5 text-red-500" />
          ) : (
            <Navigation className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
          )}
        </button>
      )}
    </div>
  );
}