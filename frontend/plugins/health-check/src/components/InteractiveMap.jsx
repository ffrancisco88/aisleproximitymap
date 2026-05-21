import React from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { motion } from "framer-motion";

/**
 * InteractiveMap
 * Props:
 *  - floorplan: { image_base64, width, height }
 *  - beacons: [{x,y,label,online}]
 *  - aisles: [{x1,y1,x2,y2,name,color}]
 *  - products: [{x,y,name}]
 *  - userPosition: {x,y} | null
 *  - route: [{x,y}] | null
 *  - onMapClick: (x,y) => void  (coords in logical units)
 *  - overlay: ReactNode
 *  - interactive: bool (allow click)
 *  - children
 */
export default function InteractiveMap({
  floorplan,
  beacons = [],
  aisles = [],
  products = [],
  userPosition = null,
  route = null,
  onMapClick,
  overlay,
  interactive = true,
  highlightProductId = null,
  showProductDots = true,
}) {
  if (!floorplan) {
    return (
      <div className="w-full h-full flex items-center justify-center map-grid rounded-xl border border-zinc-200 bg-zinc-100" data-testid="map-empty">
        <div className="text-center px-6">
          <p className="text-zinc-500 text-sm uppercase tracking-[0.2em]">No Floor Plan</p>
          <p className="text-zinc-700 mt-2">Upload a floor plan from the Admin panel</p>
        </div>
      </div>
    );
  }

  const W = floorplan.width;
  const H = floorplan.height;

  function handleClick(e) {
    if (!onMapClick || !interactive) return;
    const target = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - target.left) / target.width;
    const ry = (e.clientY - target.top) / target.height;
    onMapClick(rx * W, ry * H);
  }

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100" data-testid="interactive-map">
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={5}
        wheel={{ step: 0.15 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "100%", height: "100%" }}
        >
          <div
            onClick={handleClick}
            className="relative select-none"
            style={{ width: "min(100%,1400px)", aspectRatio: `${W}/${H}`, cursor: interactive && onMapClick ? "crosshair" : "grab" }}
            data-testid="map-canvas"
          >
            <img
              src={floorplan.image_base64}
              alt="floor plan"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />

            {/* Aisles */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {aisles.map((a) => (
                <g key={a.id}>
                  <rect
                    x={Math.min(a.x1, a.x2)}
                    y={Math.min(a.y1, a.y2)}
                    width={Math.abs(a.x2 - a.x1)}
                    height={Math.abs(a.y2 - a.y1)}
                    fill={a.color || "#0055FF"}
                    fillOpacity="0.1"
                    stroke={a.color || "#0055FF"}
                    strokeWidth="2"
                    strokeDasharray="6 4"
                  />
                  <text
                    x={(a.x1 + a.x2) / 2}
                    y={(a.y1 + a.y2) / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.max(14, W * 0.012)}
                    fontFamily="Outfit, sans-serif"
                    fontWeight="600"
                    fill="#0A0A0A"
                  >
                    {a.name}
                  </text>
                </g>
              ))}

              {/* Route Path */}
              {route && route.length > 1 && (
                <polyline
                  className="route-path"
                  points={route.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#0055FF"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Route arrow at last waypoint */}
              {route && route.length > 1 && (() => {
                const a = route[route.length - 2];
                const b = route[route.length - 1];
                const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
                return (
                  <g transform={`translate(${b.x}, ${b.y}) rotate(${angle})`}>
                    <polygon points="-14,-10 0,0 -14,10" fill="#0055FF" />
                  </g>
                );
              })()}
            </svg>

            {/* Beacons (HTML for animation) */}
            {beacons.map((b) => (
              <div
                key={b.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${(b.x / W) * 100}%`, top: `${(b.y / H) * 100}%` }}
                data-testid={`beacon-marker-${b.id}`}
              >
                <div className={`relative w-4 h-4 rounded-full border-2 border-white shadow-md ${b.online ? "bg-emerald-500 beacon-pulse" : "bg-zinc-400"}`} />
                <div className="absolute left-5 top-0 text-[10px] font-semibold bg-white/90 rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap">
                  {b.label}
                </div>
              </div>
            ))}

            {/* Products */}
            {showProductDots && products.map((p) => (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
                data-testid={`product-marker-${p.id}`}
              >
                <div className={`w-3 h-3 rotate-45 border-2 border-white shadow ${highlightProductId === p.id ? "bg-orange-500" : "bg-zinc-900"}`} />
                {highlightProductId === p.id && (
                  <div className="absolute left-4 -top-1 text-[10px] font-bold bg-orange-500 text-white rounded px-1.5 py-0.5 shadow whitespace-nowrap">
                    {p.name}
                  </div>
                )}
              </div>
            ))}

            {/* User dot */}
            {userPosition && (
              <motion.div
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ left: `${(userPosition.x / W) * 100}%`, top: `${(userPosition.y / H) * 100}%` }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                data-testid="user-location-dot"
              >
                <div className="user-dot w-5 h-5 rounded-full bg-blue-600 border-2 border-white" />
              </motion.div>
            )}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {overlay}
    </div>
  );
}
