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

export function makeProjection(W: number, H: number): GeoProjection {
  return geoEquirectangular().fitExtent([[12, 30], [Math.max(W - 12, 40), Math.max(H - 28, 60)]], SPHERE);
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
