#!/usr/bin/env node

/**
 * Build a compact GO Train-only snapshot from GTFS files.
 * Heavy parsing stays at build-time so Expo runtime remains fast.
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const GTFS_DIR = path.join(PROJECT_ROOT, 'GO-GTFS');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'go-train-static.json');

const DEFAULT_ROUTE_COLOR = '#0A7EA4';
const TRAIN_ROUTE_TYPE = '2';

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

async function readCsvRows(filePath, onRow) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lineReader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let headerIndex = null;

  for await (const line of lineReader) {
    if (!line) {
      continue;
    }

    const fields = parseCsvLine(line);
    if (!headerIndex) {
      headerIndex = {};
      for (let i = 0; i < fields.length; i += 1) {
        headerIndex[fields[i].replace(/^\uFEFF/, '').trim()] = i;
      }
      continue;
    }

    onRow(fields, headerIndex);
  }
}

function parseTimeToSeconds(timeString) {
  const match = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(timeString ?? '');
  if (!match) {
    return -1;
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function normalizeRouteColor(color) {
  const trimmed = (color ?? '').trim().toUpperCase().replace('#', '');
  if (/^[A-F0-9]{6}$/.test(trimmed)) {
    return `#${trimmed}`;
  }
  return DEFAULT_ROUTE_COLOR;
}

function parseDateArg() {
  const argument = process.argv.find((value) => value.startsWith('--serviceDate='));
  if (!argument) {
    return null;
  }
  const value = argument.split('=')[1];
  return /^\d{8}$/.test(value) ? value : null;
}

function getTodayStamp() {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatServiceDate(serviceDate) {
  return `${serviceDate.slice(0, 4)}-${serviceDate.slice(4, 6)}-${serviceDate.slice(6, 8)}`;
}

async function getAvailableServiceDates() {
  const serviceDates = new Set();
  const filePath = path.join(GTFS_DIR, 'calendar_dates.txt');

  await readCsvRows(filePath, (fields, header) => {
    const serviceId = fields[header.service_id] ?? '';
    const exceptionType = fields[header.exception_type] ?? '';
    if (serviceId && exceptionType === '1') {
      serviceDates.add(serviceId);
    }
  });

  return Array.from(serviceDates).sort();
}

async function loadTrainRoutes() {
  const routeMap = new Map();
  const filePath = path.join(GTFS_DIR, 'routes.txt');

  await readCsvRows(filePath, (fields, header) => {
    const routeType = fields[header.route_type] ?? '';
    if (routeType !== TRAIN_ROUTE_TYPE) {
      return;
    }

    const routeId = fields[header.route_id] ?? '';
    if (!routeId) {
      return;
    }

    routeMap.set(routeId, {
      routeId,
      routeShortName: fields[header.route_short_name] ?? routeId,
      routeLongName: fields[header.route_long_name] ?? routeId,
      routeColor: normalizeRouteColor(fields[header.route_color]),
    });
  });

  return routeMap;
}

async function loadStops() {
  const stopMap = new Map();
  const filePath = path.join(GTFS_DIR, 'stops.txt');

  await readCsvRows(filePath, (fields, header) => {
    const stopId = fields[header.stop_id] ?? '';
    if (!stopId) {
      return;
    }

    stopMap.set(stopId, {
      stopId,
      stopName: fields[header.stop_name] ?? stopId,
      latitude: Number(fields[header.stop_lat] ?? 0),
      longitude: Number(fields[header.stop_lon] ?? 0),
    });
  });

  return stopMap;
}

async function loadTripsForServiceDate(serviceDate, routeMap) {
  const tripsById = new Map();
  const tripsByRouteId = new Map();
  const filePath = path.join(GTFS_DIR, 'trips.txt');

  await readCsvRows(filePath, (fields, header) => {
    const currentServiceId = fields[header.service_id] ?? '';
    const routeId = fields[header.route_id] ?? '';

    if (currentServiceId !== serviceDate || !routeMap.has(routeId)) {
      return;
    }

    const tripId = fields[header.trip_id] ?? '';
    if (!tripId) {
      return;
    }

    const trip = {
      tripId,
      routeId,
      headsign: fields[header.trip_headsign] ?? routeMap.get(routeId).routeLongName,
      directionId: fields[header.direction_id] ?? '',
      stopTimes: [],
    };

    tripsById.set(tripId, trip);

    const routeTrips = tripsByRouteId.get(routeId) ?? [];
    routeTrips.push(trip);
    tripsByRouteId.set(routeId, routeTrips);
  });

  return { tripsById, tripsByRouteId };
}

async function loadStopTimes(tripsById) {
  const filePath = path.join(GTFS_DIR, 'stop_times.txt');

  await readCsvRows(filePath, (fields, header) => {
    const tripId = fields[header.trip_id] ?? '';
    const trip = tripsById.get(tripId);
    if (!trip) {
      return;
    }

    const arrivalTime = fields[header.arrival_time] ?? '';
    const departureTime = fields[header.departure_time] ?? '';
    const arrivalSeconds = parseTimeToSeconds(arrivalTime);
    const departureSeconds = parseTimeToSeconds(departureTime);
    if (arrivalSeconds < 0 || departureSeconds < 0) {
      return;
    }

    trip.stopTimes.push({
      stopId: fields[header.stop_id] ?? '',
      arrivalTime,
      departureTime,
      arrivalSeconds,
      departureSeconds,
      stopSequence: Number(fields[header.stop_sequence] ?? 0),
    });
  });
}

function buildRouteStopsAndTrips({ tripsByRouteId, stopMap }) {
  const routeStops = {};
  const routeTrips = {};
  const usedStopIds = new Set();
  let tripCount = 0;

  for (const [routeId, trips] of tripsByRouteId) {
    const routeStopMinSequence = new Map();
    const cleanedTrips = [];

    for (const trip of trips) {
      if (trip.stopTimes.length < 2) {
        continue;
      }

      trip.stopTimes.sort((a, b) => a.stopSequence - b.stopSequence);

      const validStopTimes = trip.stopTimes.filter((stopTime) => stopTime.stopId && stopMap.has(stopTime.stopId));
      if (validStopTimes.length < 2) {
        continue;
      }

      for (const stopTime of validStopTimes) {
        usedStopIds.add(stopTime.stopId);
        const current = routeStopMinSequence.get(stopTime.stopId);
        if (current === undefined || stopTime.stopSequence < current) {
          routeStopMinSequence.set(stopTime.stopId, stopTime.stopSequence);
        }
      }

      cleanedTrips.push({
        tripId: trip.tripId,
        routeId: trip.routeId,
        headsign: trip.headsign,
        directionId: trip.directionId,
        stopTimes: validStopTimes,
      });
    }

    if (cleanedTrips.length === 0) {
      continue;
    }

    cleanedTrips.sort((a, b) => a.stopTimes[0].departureSeconds - b.stopTimes[0].departureSeconds);

    routeTrips[routeId] = cleanedTrips;
    routeStops[routeId] = Array.from(routeStopMinSequence.entries())
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([stopId]) => stopId);

    tripCount += cleanedTrips.length;
  }

  return { routeStops, routeTrips, usedStopIds, tripCount };
}

async function main() {
  const requestedServiceDate = parseDateArg();
  const availableDates = await getAvailableServiceDates();
  if (availableDates.length === 0) {
    throw new Error('No service dates found in GO-GTFS/calendar_dates.txt');
  }

  const today = getTodayStamp();
  const fallbackDate = availableDates.find((date) => date >= today) ?? availableDates.at(-1);
  const serviceDate =
    requestedServiceDate && availableDates.includes(requestedServiceDate)
      ? requestedServiceDate
      : fallbackDate;

  if (!serviceDate) {
    throw new Error('Unable to determine a valid service date.');
  }

  const routeMap = await loadTrainRoutes();
  const stopMap = await loadStops();
  const { tripsById, tripsByRouteId } = await loadTripsForServiceDate(serviceDate, routeMap);

  if (tripsById.size === 0) {
    throw new Error(`No train trips found for service date ${serviceDate}.`);
  }

  await loadStopTimes(tripsById);
  const { routeStops, routeTrips, usedStopIds, tripCount } = buildRouteStopsAndTrips({
    tripsByRouteId,
    stopMap,
  });

  const activeRouteIds = Object.keys(routeTrips).sort((a, b) => {
    const routeA = routeMap.get(a).routeShortName;
    const routeB = routeMap.get(b).routeShortName;
    return routeA.localeCompare(routeB);
  });

  const routes = activeRouteIds.map((routeId) => routeMap.get(routeId));
  const stops = Array.from(usedStopIds)
    .map((stopId) => stopMap.get(stopId))
    .sort((a, b) => a.stopName.localeCompare(b.stopName));

  const output = {
    generatedAt: new Date().toISOString(),
    serviceDate,
    serviceDateISO: formatServiceDate(serviceDate),
    stats: {
      routeCount: routes.length,
      stopCount: stops.length,
      tripCount,
    },
    routes,
    stops,
    routeStops,
    routeTrips,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output), 'utf8');

  console.log(`Generated ${path.relative(PROJECT_ROOT, OUTPUT_FILE)} for service date ${serviceDate}`);
  console.log(
    `Train routes: ${output.stats.routeCount}, Stops: ${output.stats.stopCount}, Trips: ${output.stats.tripCount}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
