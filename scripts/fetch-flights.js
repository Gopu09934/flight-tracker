// scripts/fetch-flights.js
// Fetches live state vectors from the OpenSky Network API and writes a
// simplified snapshot to data/flights.json. Runs server-side (Node 18+ has
// a built-in fetch), so it is not subject to the browser CORS restriction
// that the OpenSky API enforces.
//
// Usage:
//   node scripts/fetch-flights.js
//
// Optional auth (raises the daily credit allowance from 400 to 4000+):
//   OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET  -> OAuth2 client-credentials
//   or OPENSKY_USERNAME / OPENSKY_PASSWORD     -> legacy basic auth

const fs = require('fs');
const path = require('path');

const STATES_URL = 'https://opensky-network.org/api/states/all';
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OUT_PATH = path.join(__dirname, '..', 'data', 'flights.json');

async function getAuthHeader() {
  const { OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, OPENSKY_USERNAME, OPENSKY_PASSWORD } = process.env;

  if (OPENSKY_CLIENT_ID && OPENSKY_CLIENT_SECRET) {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: OPENSKY_CLIENT_ID,
      client_secret: OPENSKY_CLIENT_SECRET,
    });
    const res = await fetch(TOKEN_URL, { method: 'POST', body });
    if (!res.ok) throw new Error(`OAuth token request failed: ${res.status}`);
    const { access_token } = await res.json();
    return { Authorization: `Bearer ${access_token}` };
  }

  if (OPENSKY_USERNAME && OPENSKY_PASSWORD) {
    const token = Buffer.from(`${OPENSKY_USERNAME}:${OPENSKY_PASSWORD}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }

  return {};
}

function mapState(s) {
  return {
    icao24: s[0],
    callsign: (s[1] || '').trim(),
    country: s[2],
    lon: s[5],
    lat: s[6],
    altitude: s[7] != null ? s[7] : s[13],
    on_ground: s[8],
    velocity: s[9],
    heading: s[10],
    vertical_rate: s[11],
  };
}

async function main() {
  const headers = await getAuthHeader();
  const res = await fetch(STATES_URL, { headers });

  if (!res.ok) {
    throw new Error(`OpenSky request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const flights = (json.states || [])
    .map(mapState)
    .filter(f => f.lat != null && f.lon != null);

  const snapshot = {
    generated_at: new Date().toISOString(),
    source: 'opensky-network',
    count: flights.length,
    flights,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot));
  console.log(`Wrote ${flights.length} flights to ${OUT_PATH}`);
}

main().catch(err => {
  console.error('fetch-flights failed:', err.message);
  process.exit(1);
});
