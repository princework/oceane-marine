"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/** Get a free key at maptiler.com and set NEXT_PUBLIC_MAPTILER_KEY — falls back to a plainer, keyless basemap when unset. */
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();

/* ─────────── colour helpers ─────────── */
function markerColour(loc) {
  if (loc.inProgress > 0) return "#60a5fa"; // light blue – active
  if (loc.completed > 0)  return "#34d399"; // light green – all done
  if (loc.cancelled > 0)  return "#f87171"; // light red – cancelled
  return "#fbbf24";                          // light amber – lined-up / pending
}

function markerRadius(total) {
  if (total >= 20) return 16;
  if (total >= 10) return 13;
  if (total >= 5)  return 10;
  return 8;
}

/* ─────────── auto-fit bounds ─────────── */
/** Fits the view to the markers once on first load only — a periodic background
 * refresh must never yank the user's zoom/pan back to fit-all. */
function FitBounds({ markers }) {
  const map = useMap();
  const hasFitRef = useRef(false);

  useEffect(() => {
    if (hasFitRef.current) return;
    if (!markers || markers.length === 0) return;
    const bounds = markers.map((m) => [m.lat, m.lng]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    hasFitRef.current = true;
  }, [markers, map]);

  return null;
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function OperationsMap({ year, month, refreshKey }) {
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const lastFilterRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      // Only show the full loading overlay when year/month actually changed —
      // a periodic background refresh (refreshKey alone) should update
      // markers quietly in place, not flash a spinner over the map every 5 minutes.
      const filterKey = `${year || ""}:${month || ""}`;
      if (lastFilterRef.current !== filterKey) setLoading(true);
      lastFilterRef.current = filterKey;
      try {
        const params = new URLSearchParams();
        if (year)  params.append("year", year.toString());
        if (month) params.append("month", month.toString());

        const res = await fetch(`/api/operations/dashboard/map-data?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
          setMarkers(json.data || []);
        }
      } catch (err) {
        console.error("Map fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year, month, refreshKey]);

  const totalOps = markers.reduce((s, m) => s + m.total, 0);

  return (
    <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md shadow-2xl p-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Operations Map</h2>
          <p className="text-xs text-slate-400">
            {markers.length} location{markers.length !== 1 ? "s" : ""} · {totalOps} operation{totalOps !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] text-slate-300">
          <span className="flex items-center gap-1 whitespace-nowrap"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" /> In Progress</span>
          <span className="flex items-center gap-1 whitespace-nowrap"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" /> Completed</span>
          <span className="flex items-center gap-1 whitespace-nowrap"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending</span>
          <span className="flex items-center gap-1 whitespace-nowrap"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> Cancelled</span>
        </div>
      </div>

      {/* Map */}
      <div className="w-full h-[380px] rounded-xl overflow-hidden border border-white/10 relative">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        )}

        <MapContainer
          ref={mapRef}
          center={[20, 55]}
          zoom={3}
          minZoom={2}
          maxZoom={10}
          scrollWheelZoom={true}
          className="w-full h-full"
          style={{ background: "#dce6f0" }}
        >
          {MAPTILER_KEY ? (
            /* MapTiler "dataviz" — a clean, modern light style designed for
               overlaying data markers, English labels, free tier (100k
               loads/month, no card required). Needs NEXT_PUBLIC_MAPTILER_KEY. */
            <TileLayer
              url={`https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`}
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              tileSize={512}
              zoomOffset={-1}
            />
          ) : (
            /* Fallback while no MapTiler key is configured — free, no key,
               English labels, just plainer-looking than MapTiler's styles. */
            <>
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri"
              />
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}" />
            </>
          )}

          {/* Auto-fit when data changes */}
          {markers.length > 0 && <FitBounds markers={markers} />}

          {/* Markers */}
          {markers.map((loc) => (
            <CircleMarker
              key={loc.name}
              center={[loc.lat, loc.lng]}
              radius={markerRadius(loc.total)}
              pathOptions={{
                fillColor: markerColour(loc),
                color: markerColour(loc),
                weight: 2,
                fillOpacity: 0.55,
                opacity: 0.8,
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-bold text-sm mb-1" style={{ color: "#1e40af" }}>{loc.name}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-gray-500">Total:</span>
                    <span className="font-semibold text-gray-800">{loc.total}</span>
                    {loc.completed > 0 && (
                      <>
                        <span className="text-emerald-600">Completed:</span>
                        <span className="text-gray-800">{loc.completed}</span>
                      </>
                    )}
                    {loc.inProgress > 0 && (
                      <>
                        <span className="text-blue-600">In Progress:</span>
                        <span className="text-gray-800">{loc.inProgress}</span>
                      </>
                    )}
                    {loc.pending > 0 && (
                      <>
                        <span className="text-amber-600">Pending:</span>
                        <span className="text-gray-800">{loc.pending}</span>
                      </>
                    )}
                    {loc.cancelled > 0 && (
                      <>
                        <span className="text-red-600">Cancelled:</span>
                        <span className="text-gray-800">{loc.cancelled}</span>
                      </>
                    )}
                  </div>

                  {/* Recent operations */}
                  {loc.operations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">Recent</p>
                      {loc.operations.map((op, i) => (
                        <p key={i} className="text-[11px] text-gray-600 leading-tight">
                          <span className="font-medium text-gray-800">{op.refNo}</span>
                          {op.chs && <span className="text-gray-400"> · {op.chs}</span>}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
