import { CITY_BY_ID, GMT_CITY, MAP_CITIES, MAP_LABELLED, type City } from './cities';
import type { Prefs } from './prefs';
import { isDaylight } from './solar';
import { zonedParts, type ZonedParts } from './time';

export interface CityView {
  city: City;
  p: ZonedParts;
  /** Minutes ahead (+) / behind (−) home at this instant. */
  diff: number;
  /** Local calendar date relative to home's: −1 previous day, +1 next day. */
  dayDelta: number;
  isDay: boolean;
  isHome: boolean;
  ruler: boolean;
  /** Drawn with a name + time label on the map: every ruler city plus the always-labelled set (MAP_LABELLED), unless switched off in Manage; plus any plain dot switched on there. */
  labelled: boolean;
  gmt: boolean;
}

export interface Model {
  utc: number;
  home: CityView;
  /** Every dot on the map: handoff map cities plus any saved or always-labelled city outside that set. */
  map: CityView[];
  /** Saved cities + GMT, west → east by actual UTC offset at `utc`. */
  ruler: CityView[];
  byId: Map<string, CityView>;
}

export function buildModel(utc: number, prefs: Pick<Prefs, 'ruler' | 'home' | 'labelsOff' | 'labelsOn'>): Model {
  const homeCity = CITY_BY_ID.get(prefs.home)!;
  const hp = zonedParts(utc, homeCity.tz);
  const saved = new Set(prefs.ruler);
  const labelled = new Set([...prefs.ruler, ...MAP_LABELLED, ...prefs.labelsOn]);
  for (const id of prefs.labelsOff) labelled.delete(id);
  const view = (city: City, gmt = false): CityView => {
    const p = zonedParts(utc, city.tz);
    return {
      city, p, diff: p.offsetMin - hp.offsetMin, dayDelta: p.epochDay - hp.epochDay,
      isDay: isDaylight(utc, city.lat, city.lon), isHome: city.id === prefs.home, ruler: saved.has(city.id), labelled: labelled.has(city.id), gmt,
    };
  };
  const extra = [...new Set([...prefs.ruler, ...MAP_LABELLED])].map(id => CITY_BY_ID.get(id)!).filter(c => !c.map);
  const cities = [...MAP_CITIES, ...extra];
  const map = cities.map(c => view(c));
  const byId = new Map(map.map(v => [v.city.id, v]));
  const ruler = [...map.filter(v => v.ruler), view(GMT_CITY, true)]
    .sort((a, b) => a.p.offsetMin - b.p.offsetMin || Number(b.gmt) - Number(a.gmt) || a.city.lon - b.city.lon);
  return { utc, home: byId.get(prefs.home)!, map, ruler, byId };
}
