// ======================================================================
// GIS Analysis Dashboard
// ----------------------------------------------------------------------
// Calculates a "Service Readiness Index" for growth areas based on
// proximity to water & wastewater mains and local pipe density.
// ----------------------------------------------------------------------
// Author: M. Imani
// Last updated: 31 Oct 2025
// ======================================================================

// ======================= MAP INITIALISATION ============================
const map = L.map('map', {zoomControl: true}).setView([-34.93, 138.6], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap'
}).addTo(map);

// ========================== LOAD DATA =================================
async function loadJSON(path){
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path}`);
  return await resp.json();
}

(async function main(){
  try {
    // --- Load local GeoJSONs (placed in /data folder) ---
    const growth     = await loadJSON('data/growth_areas.json');
    const wastewater = await loadJSON('data/wastewater_main.json');
    let   water      = {type:'FeatureCollection',features:[]};

    try {
      water = await loadJSON('data/water_main.json');
    } catch(e){ console.warn('No water_main.json found, continuing with wastewater only.'); }

    // --- Draw base network layers ---
    const waterLayer = L.geoJSON(water, {
      style:{color:'#1e88e5', weight:2, opacity:0.9}
    }).addTo(map);

    const sewerLayer = L.geoJSON(wastewater, {
      style:{color:'#14b8a6', weight:2, opacity:0.9}
    }).addTo(map);

    // --- Layer for styled growth polygons ---
    const polyLayer = L.geoJSON(null, {
      style: f => ({
        color:'#000', weight:1,
        fillOpacity:0.65,
        fillColor: colorByReadiness(f.properties?.readiness || 0)
      }),
      onEachFeature: (f, layer)=>{
        const p = f.properties;
        layer.bindPopup(`
          <strong>${displayName(p)}</strong><br>
          Water Dist: ${fmt(p._waterDist)} km<br>
          WW Dist: ${fmt(p._sewerDist)} km<br>
          PipeLen: ${fmt(p._pipeLen)} km<br>
          <b>Readiness:</b> ${(p.readiness*100).toFixed(1)}%
        `);
      }
    }).addTo(map);

    // --- Fit map to data extent ---
    const allBounds = L.featureGroup([waterLayer, sewerLayer]).getBounds();
    if (allBounds.isValid()) map.fitBounds(allBounds);

    // =================== ANALYSIS PER POLYGON =========================
    const tbody  = document.querySelector('#resultTbl tbody');
    const polys  = growth.features || [];

    console.time('AnalysisTime');
    for (let i=0;i<polys.length;i++){
      const area = polys[i];
      const name = displayName(area.properties, i);

      // Limit search area for speed (2 km radius)
      const waterNear = linesNearPolygon(area, water, 2);
      const sewerNear = linesNearPolygon(area, wastewater, 2);

      // Centroid-based nearest distances
      const center = turf.centroid(area);
      const wDist  = nearestLineDistanceKm_local(center, waterNear);
      const sDist  = nearestLineDistanceKm_local(center, sewerNear);

      // Total pipe length within 250 m buffer
      const pipeLenKm = sumLengthWithinBufferKm_local(area, waterNear, sewerNear, 0.25);

      // Compute readiness
      const readiness = readinessScore(wDist, sDist, pipeLenKm);

      // Attach for display & map style
      Object.assign(area.properties, {
        _displayName: name,
        _waterDist: wDist,
        _sewerDist: sDist,
        _pipeLen: pipeLenKm,
        readiness: readiness
      });

      // Add to map and table
      polyLayer.addData(area);
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${name}</td>
          <td>${fmt(wDist)}</td>
          <td>${fmt(sDist)}</td>
          <td>${fmt(pipeLenKm)}</td>
          <td>${(readiness*100).toFixed(1)}%</td>
        </tr>
      `);
    }
    console.timeEnd('AnalysisTime');

    // Zoom to polygons if network bounds invalid
    if (!allBounds.isValid() && polyLayer.getBounds().isValid()){
      map.fitBounds(polyLayer.getBounds());
    }

  } catch (err) {
    console.error('Analysis error:', err);
    alert('Analysis failed. See console for details.');
  }
})();

// ======================== HELPER FUNCTIONS ============================

// --- Name resolver ---
function displayName(props, idx=0){
  const keys = ['name','NAME','Label','LABEL','AREA_NAME','REGION','SA2_NAME','SUBURB','LGA_NAME','TITLE'];
  for (const k of keys){ if (props && props[k]) return String(props[k]); }
  return `Area ${idx+1}`;
}

// --- Colour ramp ---
function colorByReadiness(r){
  return r>=0.7 ? '#22c55e'   // green
       : r>=0.4 ? '#eab308'   // yellow
       : '#ef4444';           // red
}

// --- Number format ---
function fmt(x){ return (x===Infinity||!isFinite(x)) ? '—' : Number(x).toFixed(2); }

// ======================== GEOSPATIAL UTILITIES ========================

/**
 * Filter lines to those within <radiusKm> of a polygon (by bbox buffer).
 */
function linesNearPolygon(poly, lineFC, radiusKm){
  if (!lineFC?.features?.length) return {type:'FeatureCollection', features:[]};
  const bb   = turf.bbox(poly);
  const box  = turf.bboxPolygon(bb);
  const buf  = turf.buffer(box, radiusKm, {units:'kilometers'});
  const near = [];
  for (const f of lineFC.features){
    if (f.geometry?.type === 'LineString' && turf.booleanIntersects(buf, f)){
      near.push(f);
    }
  }
  return {type:'FeatureCollection', features: near};
}

/**
 * Minimum distance (km) from point to any line in a FeatureCollection.
 */
function nearestLineDistanceKm_local(point, lineFC){
  if (!lineFC?.features?.length) return Infinity;
  let min = Infinity;
  for (const f of lineFC.features){
    const d = turf.pointToLineDistance(point, f, {units:'kilometers'});
    if (d < min) min = d;
  }
  return min;
}

/**
 * Sum of full line lengths (km) intersecting a polygon buffer.
 */
function sumLengthWithinBufferKm_local(poly, waterFC, sewerFC, bufferKm){
  const buf = turf.buffer(poly, bufferKm, {units:'kilometers'});
  let total = 0;
  const add = (fc)=>{
    if (!fc?.features) return;
    for (const f of fc.features){
      if (f.geometry?.type === 'LineString' && turf.booleanIntersects(buf, f)){
        total += turf.length(f, {units:'kilometers'});
      }
    }
  };
  add(waterFC); add(sewerFC);
  return total;
}

/**
 * Adaptive readiness scoring:
 *  - shorter distance → higher readiness
 *  - more local pipe length → higher readiness
 *  - reweights if one network missing locally
 */
function readinessScore(wDistKm, sDistKm, lenKm){
  const toIdx = d => (d===Infinity) ? 0 : (1 - Math.min(d/0.6, 1)); // cap 600 m
  const wIdx = toIdx(wDistKm);
  const sIdx = toIdx(sDistKm);
  const dIdx = Math.min(lenKm/1.5, 1); // 1.5 km = "good density"

  // Dynamic weighting
  const weights = (wIdx===0 && sIdx===0) ? [0.0, 0.0, 1.0]
                 : (wIdx===0)            ? [0.0, 0.6, 0.4]
                 : (sIdx===0)            ? [0.6, 0.0, 0.4]
                 :                         [0.4, 0.4, 0.2];
  return weights[0]*wIdx + weights[1]*sIdx + weights[2]*dIdx;
}
