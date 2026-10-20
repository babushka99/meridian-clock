import { describe, expect, it } from 'vitest';
import { geoContains, geoDistance } from 'd3-geo';
import { getPosition } from 'suncalc';
import { shading } from '../../src/lib/mapgeo';
import { antipode, HORIZON_DEG, isDaylight, solarDay, subsolarPoint, sunAltitude } from '../../src/lib/solar';
import { clockAt, zonedParts } from '../../src/lib/time';

const INSTANTS = [
  Date.UTC(2026, 9, 7, 4, 53), Date.UTC(2026, 9, 7, 21, 30), Date.UTC(2026, 2, 20, 14, 46), Date.UTC(2026, 5, 21, 8, 24),
  Date.UTC(2026, 11, 21, 20, 50), Date.UTC(2026, 0, 1, 0, 0), Date.UTC(2027, 7, 15, 12, 0), Date.UTC(2026, 9, 7, 11, 47), Date.UTC(2026, 3, 3, 23, 59),
];
const deg = (r: number) => (r * 180) / Math.PI;

describe('subsolar point and map shading', () => {
  it('subsolar point agrees with an independent solar position (SunCalc): sun at the zenith there', () => {
    for (const t of INSTANTS) {
      const [lon, lat] = subsolarPoint(t);
      expect(getPosition(new Date(t), lat, lon).altitude, new Date(t).toISOString()).toBeGreaterThan(89.4);
      expect(sunAltitude(t, lat, lon)).toBeCloseTo(90, 3);
      const [alon, alat] = antipode([lon, lat]);
      expect(getPosition(new Date(t), alat, alon).altitude).toBeLessThan(-89.4);
    }
  });
  it('known geometry: equinox declination ≈ 0, solstices ≈ ±23.44°, noon UTC sun near Greenwich', () => {
    expect(Math.abs(subsolarPoint(Date.UTC(2026, 2, 20, 14, 46))[1])).toBeLessThan(0.1);
    expect(subsolarPoint(Date.UTC(2026, 5, 21, 8, 24))[1]).toBeCloseTo(23.44, 1);
    expect(subsolarPoint(Date.UTC(2026, 11, 21, 20, 50))[1]).toBeCloseTo(-23.44, 1);
    expect(Math.abs(subsolarPoint(Date.UTC(2026, 3, 15, 12, 0))[0])).toBeLessThan(1); // equation of time ≈ 0 mid-April
  });
  it('shading: subsolar point is in daylight, its antipode in darkness, for every layer', () => {
    for (const t of INSTANTS) {
      const s = shading(t);
      expect(geoContains(s.day, s.sun)).toBe(true);
      expect(geoContains(s.day, s.anti)).toBe(false);
      for (const layer of [s.twilightOuter, s.night, s.twilightInner]) {
        expect(geoContains(layer, s.anti)).toBe(true);
        expect(geoContains(layer, s.sun)).toBe(false);
      }
      expect(deg(geoDistance(s.sun, s.anti))).toBeCloseTo(180, 6);
    }
  });
  it('the night polygon matches computed altitude at sampled points', () => {
    const t = Date.UTC(2026, 9, 7, 4, 53), s = shading(t);
    let checked = 0;
    for (let lat = -80; lat <= 80; lat += 20) for (let lon = -175; lon <= 175; lon += 25) {
      const alt = sunAltitude(t, lat, lon);
      if (Math.abs(alt) < 1.5) continue; // skip the polygon's own discretisation band
      expect(geoContains(s.night, [lon, lat]), `${lat},${lon}`).toBe(alt < 0);
      checked++;
    }
    expect(checked).toBeGreaterThan(80);
  });
  it('city day/night: Istanbul 7:53 AM is day, San Francisco 9:53 PM is night', () => {
    const t = Date.UTC(2026, 9, 7, 4, 53);
    expect(isDaylight(t, 41.01, 28.98)).toBe(true);
    expect(isDaylight(t, 37.77, -122.42)).toBe(false);
    expect(isDaylight(t, 35.68, 139.69)).toBe(true);
  });
});

describe('sunrise / sunset for the local calendar date', () => {
  const day = (tz: string, y: number, mo: number, d: number, lat: number, lon: number) => solarDay(tz, y, mo, d, lat, lon);
  const within = (actual: number | null, tz: string, expected: string, tolMin = 4) => {
    expect(actual).not.toBeNull();
    const [h, m] = expected.split(':').map(Number), p = zonedParts(actual!, tz);
    expect(Math.abs(p.h * 60 + p.mi - (h * 60 + m)), `${clockAt(actual!, tz, false)} vs ${expected}`).toBeLessThanOrEqual(tolMin);
  };
  it('matches published times (Istanbul, New York, Oct 7 2026)', () => {
    const ist = day('Europe/Istanbul', 2026, 10, 7, 41.01, 28.98);
    within(ist.sunrise, 'Europe/Istanbul', '07:05'); within(ist.sunset, 'Europe/Istanbul', '18:37');
    const ny = day('America/New_York', 2026, 10, 7, 40.71, -74.01);
    within(ny.sunrise, 'America/New_York', '07:00'); within(ny.sunset, 'America/New_York', '18:28');
    expect(ist.dawn!).toBeLessThan(ist.sunrise!); expect(ist.dusk!).toBeGreaterThan(ist.sunset!);
  });
  it('events fall inside the local date and the sun is on the horizon at them', () => {
    const cases: [string, number, number][] = [['Pacific/Auckland', -36.85, 174.76], ['Pacific/Honolulu', 21.31, -157.86], ['Asia/Kathmandu', 27.72, 85.32], ['America/Anchorage', 61.22, -149.9], ['Asia/Shanghai', 43.8, 87.6], ['Pacific/Kiritimati', 1.87, -157.43]];
    for (const [tz, lat, lon] of cases) for (const [mo, d] of [[10, 7], [1, 1], [6, 30], [12, 31]]) {
      const s = day(tz, 2026, mo, d, lat, lon);
      for (const e of [s.sunrise, s.sunset]) {
        expect(e, `${tz} ${mo}/${d}`).not.toBeNull();
        expect(e! >= s.start && e! < s.end).toBe(true);
        const p = zonedParts(e!, tz);
        expect([p.mo, p.d]).toEqual([mo, d]);
        expect(Math.abs(sunAltitude(e!, lat, lon) - HORIZON_DEG)).toBeLessThan(0.6);
      }
    }
  });
  it('near midnight and across the date line each city uses its own local date', () => {
    // 2026-10-07 10:30Z: Auckland is 11:30 PM Oct 7, Honolulu 12:30 AM Oct 7, Kiritimati 12:30 AM Oct 8.
    const t = Date.UTC(2026, 9, 7, 10, 30);
    const a = zonedParts(t, 'Pacific/Auckland'), h = zonedParts(t, 'Pacific/Honolulu'), k = zonedParts(t, 'Pacific/Kiritimati');
    expect([a.d, a.h, h.d, h.h, k.d, k.h]).toEqual([7, 23, 7, 0, 8, 0]);
    const sa = day('Pacific/Auckland', a.y, a.mo, a.d, -36.85, 174.76), sh = day('Pacific/Honolulu', h.y, h.mo, h.d, 21.31, -157.86), sk = day('Pacific/Kiritimati', k.y, k.mo, k.d, 1.87, -157.43);
    expect(zonedParts(sa.sunrise!, 'Pacific/Auckland').d).toBe(7);   // already past: this morning's sunrise
    expect(sa.sunrise!).toBeLessThan(t);
    expect(zonedParts(sh.sunrise!, 'Pacific/Honolulu').d).toBe(7);   // still to come today
    expect(sh.sunrise!).toBeGreaterThan(t);
    expect(zonedParts(sk.sunrise!, 'Pacific/Kiritimati').d).toBe(8);
    // Honolulu and Kiritimati share a longitude band: same sun, dates one apart.
    expect(Math.abs(sk.sunrise! - sh.sunrise!)).toBeLessThan(40 * 60000);
    // One minute before / after local midnight selects different dates.
    const before = zonedParts(Date.UTC(2026, 9, 7, 20, 59), 'Europe/Istanbul'), after = zonedParts(Date.UTC(2026, 9, 7, 21, 0), 'Europe/Istanbul');
    expect([before.d, after.d]).toEqual([7, 8]);
    const s7 = day('Europe/Istanbul', 2026, 10, 7, 41.01, 28.98), s8 = day('Europe/Istanbul', 2026, 10, 8, 41.01, 28.98);
    expect(s8.sunrise! - s7.sunrise!).toBeGreaterThan(23.9 * 3600000);
    expect(s8.start).toBe(s7.end);
  });
  it('polar day and polar night (Tromsø, Longyearbyen, McMurdo)', () => {
    expect(day('Europe/Oslo', 2026, 6, 21, 69.65, 18.96)).toMatchObject({ polar: 'day', sunrise: null, sunset: null });
    expect(day('Europe/Oslo', 2026, 12, 21, 69.65, 18.96)).toMatchObject({ polar: 'night', sunrise: null, sunset: null });
    expect(day('Arctic/Longyearbyen', 2026, 12, 21, 78.22, 15.64).polar).toBe('night');
    expect(day('Antarctica/McMurdo', 2026, 12, 21, -77.85, 166.67).polar).toBe('day');
    const tromso = day('Europe/Oslo', 2026, 12, 21, 69.65, 18.96);
    expect(Math.max(...tromso.alts)).toBeLessThan(HORIZON_DEG);
    expect(Math.max(...tromso.alts)).toBeGreaterThan(-6); // civil twilight at midday, even in polar night
    expect(day('Europe/Oslo', 2026, 3, 20, 69.65, 18.96).polar).toBeNull();
  });
  it('23-hour and 25-hour dates keep one sunrise and one sunset inside the window', () => {
    const spring = day('America/New_York', 2026, 3, 8, 40.71, -74.01), fall = day('America/New_York', 2026, 11, 1, 40.71, -74.01);
    expect((spring.end - spring.start) / 3600000).toBe(23);
    expect((fall.end - fall.start) / 3600000).toBe(25);
    within(spring.sunrise, 'America/New_York', '07:19'); within(spring.sunset, 'America/New_York', '18:55');
    within(fall.sunrise, 'America/New_York', '06:27'); within(fall.sunset, 'America/New_York', '16:51');
    for (const s of [spring, fall]) {
      expect(s.alts.length).toBe(97);
      expect(s.sunrise! > s.start && s.sunset! < s.end && s.sunrise! < s.sunset!).toBe(true);
    }
  });
});
