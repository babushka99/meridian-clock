import { geoCircle, geoEquirectangular, geoGraticule, geoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import topo from 'world-atlas/countries-110m.json';
import { antipode, subsolarPoint } from './solar';

// Natural Earth 1:110m countries (public domain) via world-atlas, bundled — no network fetch.
const world = topo as unknown as Topology<{ countries: GeometryCollection }>;
export const LAND = feature(world, world.objects.countries);
export const GRATICULE = geoGraticule().step([15, 30])();
export const SPHERE = { type: 'Sphere' } as const;

/** Latitude kept at the vertical centre when a wide window crops the poles (most cities lie north of the equator). */
const CROP_CENTRE = 10;

/**
 * Fits the whole globe when the map area is 2:1 or taller. A wider area is filled edge to edge instead: the
 * scale follows the width and the polar caps (Arctic ice, Antarctica — no cities) are cropped top and bottom.
 */
export function makeProjection(W: number, H: number): GeoProjection {
  const x0 = 12, y0 = 30, x1 = Math.max(W - 12, 40), y1 = Math.max(H - 28, 60);
  if (x1 - x0 <= 2 * (y1 - y0)) return geoEquirectangular().fitExtent([[x0, y0], [x1, y1]], SPHERE);
  const k = (x1 - x0) / (2 * Math.PI), half = ((y1 - y0) / 2 / k) * (180 / Math.PI); // visible half-height, degrees
  const centre = Math.min(Math.max(CROP_CENTRE, half - 90), 90 - half);
  return geoEquirectangular().scale(k).translate([(x0 + x1) / 2, (y0 + y1) / 2 + (centre * Math.PI / 180) * k]).clipExtent([[x0, y0], [x1, y1]]);
}
export const pathFor = (projection: GeoProjection) => geoPath(projection);

/** Geometry of the day/night overlay for an instant (same construction as the prototype). */
export function shading(utc: number) {
  const sun = subsolarPoint(utc), anti = antipode(sun);
  const circle = (center: [number, number], radius: number) => geoCircle().center(center).radius(radius)();
  return {
    sun, anti,
    day: circle(sun, 90),
    /** Sun below +6°: the outer edge of the twilight gradient. */
    twilightOuter: circle(anti, 96),
    /** Sun below the horizon; its edge is the terminator. */
    night: circle(anti, 90),
    /** Sun below −6°: end of civil twilight. */
    twilightInner: circle(anti, 84),
  };
}
