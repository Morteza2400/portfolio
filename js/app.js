// ======================== Config ========================
const SERVICE_URL = 'https://lsa4.geohub.sa.gov.au/server/rest/services/LSA/LocationSAViewerV32/MapServer';

const LAYER_IDS = {
  reclaimedWaterMains: 83,
  waterMains: 84,
  hydrants: 334,
  pillarHydrants: 335,
  wwGravity: 85,
  wwLowPressure: 86,
  wwPumping: 87,
  wwVacuum: 88
};
// Map the UI/registry keys to actual MapServer layer IDs
const KEY_TO_ID = {
  waterMains:        LAYER_IDS.waterMains,
  reclaimed:         LAYER_IDS.reclaimedWaterMains,  // <- important
  hydrants:          LAYER_IDS.hydrants,
  pillarHydrants:    LAYER_IDS.pillarHydrants,
  wwGravity:         LAYER_IDS.wwGravity,
  wwLowPressure:     LAYER_IDS.wwLowPressure,
  wwPumping:         LAYER_IDS.wwPumping,
  wwVacuum:          LAYER_IDS.wwVacuum
};

const MIN_ZOOM_HINT = {
  [LAYER_IDS.waterMains]: 13,
  [LAYER_IDS.hydrants]: 15,
  [LAYER_IDS.pillarHydrants]: 15,
  [LAYER_IDS.reclaimedWaterMains]: 12,
  [LAYER_IDS.wwGravity]: 13,
  [LAYER_IDS.wwLowPressure]: 12,
  [LAYER_IDS.wwPumping]: 12,
  [LAYER_IDS.wwVacuum]: 12
};

// ======================== Map init ========================
const map = L.map('map').setView([-34.93, 138.6], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap'
}).addTo(map);

// One layers control (no duplicates)
let layersCtl = null;
const overlays = {};
function refreshLayerControl() {
  if (layersCtl) layersCtl.remove();
  if (Object.keys(overlays).length) {
    layersCtl = L.control.layers(null, overlays, { collapsed: false }).addTo(map);
  }
}

// ======================== Utils ========================
function buildPopupHTML(title, props, keep = 12) {
  const rows = Object.entries(props || {})
    .slice(0, keep)
    .map(([k, v]) => `<div class="k">${k}</div><div class="v">${v ?? '—'}</div>`)
    .join('');
  return `<div class="popup">
    <h3>${title} <span class="badge">LocationSA</span></h3>
    <div class="kv">${rows}</div>
  </div>`;
}
function circleOpts(color, size = 7) {
  return { radius: size, color: '#1f2937', weight: 1.2, fillColor: color, fillOpacity: 1 };
}
const scaleHintEl = document.getElementById('scaleHint');
function updateScaleHint() {
  const z = map.getZoom();
  const msgs = [];
  if (map.hasLayer(hydrantsCluster) && z < (MIN_ZOOM_HINT[LAYER_IDS.hydrants] || 0))
    msgs.push('Hydrants hidden at this zoom by service; zoom in.');
  if (map.hasLayer(pillarHydCluster) && z < (MIN_ZOOM_HINT[LAYER_IDS.pillarHydrants] || 0))
    msgs.push('Pillar Hydrants hidden at this zoom by service; zoom in.');
  scaleHintEl.textContent = msgs.join(' ');
}

// ======================== Layers ========================
// Water Mains — ON by default
const waterMains = L.esri.featureLayer({
  url: `${SERVICE_URL}/${LAYER_IDS.waterMains}`,
  where: '1=1',
  simplifyFactor: 0.5,
  precision: 5,
  style: () => ({ color: '#1e88e5', weight: 2.2, opacity: 0.95 })
})
.on('click', e => {
  const props = e.layer.feature?.properties || e.layer.feature?.attributes || {};
  e.layer.bindPopup(buildPopupHTML('Water Main', props)).openPopup();
})
.addTo(map);
overlays['LSA – Water Main'] = waterMains;
refreshLayerControl();


// Reclaimed Mains — OFF
const reclaimed = L.esri.featureLayer({
  url: `${SERVICE_URL}/${LAYER_IDS.reclaimedWaterMains}`,
  style: () => ({ color: '#6f42c1', weight: 2.2, opacity: 0.95 })
})
.on('click', e => {
  const props = e.layer.feature?.properties || e.layer.feature?.attributes || {};
  e.layer.bindPopup(buildPopupHTML('Reclaimed Water Main', props));
});
overlays['LSA – Reclaimed Water Main'] = reclaimed; refreshLayerControl();

// Hydrants — clustered, OFF
const hydrantsCluster = L.esri.Cluster.featureLayer({
  url: `${SERVICE_URL}/${LAYER_IDS.hydrants}`,
  pointToLayer: (_g, latlng) => L.circleMarker(latlng, circleOpts('#e74c3c', 7))
})
.on('click', e => {
  const props = e.layer.feature?.properties || e.layer.feature?.attributes || {};
  e.layer.bindPopup(buildPopupHTML('Hydrant', props)).openPopup();
})
.addTo(map);
overlays['LSA – Hydrant (clustered)'] = hydrantsCluster; refreshLayerControl();

// Pillar Hydrants — clustered, OFF
const pillarHydCluster = L.esri.Cluster.featureLayer({
  url: `${SERVICE_URL}/${LAYER_IDS.pillarHydrants}`,
  pointToLayer: (_g, latlng) => L.circleMarker(latlng, circleOpts('#f59e0b', 7))
})
.on('click', e => {
  const props = e.layer.feature?.properties || e.layer.feature?.attributes || {};
  e.layer.bindPopup(buildPopupHTML('Pillar Hydrant', props)).openPopup();
});
overlays['LSA – Pillar Hydrant (clustered)'] = pillarHydCluster; refreshLayerControl();

// NEW: Wastewater mains — OFF
function wwStyle(color){ return { color, weight: 2.0, opacity: 0.9, dashArray:'3,4' }; }

const wwGravity = L.esri.featureLayer({
  url: `${SERVICE_URL}/${LAYER_IDS.wwGravity}`, style: () => wwStyle('#14b8a6') // teal
}).on('click', e => e.layer.bindPopup(buildPopupHTML('WW Gravity Main', e.layer.feature?.properties || e.layer.feature?.attributes || {})));
overlays['LSA – WW Gravity Main'] = wwGravity; refreshLayerControl();

const wwLowPressure = L.esri.featureLayer({
  url: `${SERVICE_URL}/${LAYER_IDS.wwLowPressure}`, style: () => wwStyle('#789262') // olive
}).on('click', e => e.layer.bindPopup(buildPopupHTML('WW Low Pressure', e.layer.feature?.properties || e.layer.feature?.attributes || {})));
overlays['LSA – WW Low Pressure'] = wwLowPressure; refreshLayerControl();

const wwPumping = L.esri.featureLayer({
  url: `${SERVICE_URL}/${LAYER_IDS.wwPumping}`, style: () => wwStyle('#ec4899') // pink
}).on('click', e => e.layer.bindPopup(buildPopupHTML('WW Pumping', e.layer.feature?.properties || e.layer.feature?.attributes || {})));
overlays['LSA – WW Pumping'] = wwPumping; refreshLayerControl();

const wwVacuum = L.esri.featureLayer({
  url: `${SERVICE_URL}/${LAYER_IDS.wwVacuum}`, style: () => wwStyle('#8d6e63') // brown
}).on('click', e => e.layer.bindPopup(buildPopupHTML('WW Vacuum', e.layer.feature?.properties || e.layer.feature?.attributes || {})));
overlays['LSA – WW Vacuum'] = wwVacuum; refreshLayerControl();
// Registry so the filter UI can find layers by key
const layerRegistry = {
  waterMains,
  reclaimed,
  hydrants: hydrantsCluster,
  pillarHydrants: pillarHydCluster,
  wwGravity,
  wwLowPressure,
  wwPumping,
  wwVacuum
};

// Track active where-clause per layer for analytics queries too
const whereMap = new Map();

// Fire Ban Districts — local GeoJSON, OFF
fetch('data/FireBanDistricts_GDA2020.geojson')
  .then(r => r.json())
  .then(data => {
    const fireBans = L.geoJSON(data, {
      style: { color: '#ff8f00', weight: 2, fillColor: '#ffb74d', fillOpacity: 0.25 },
      onEachFeature: (f, layer) => {
        const html = buildPopupHTML(f.properties?.NAME || 'Fire Ban District', f.properties || {});
        layer.bindPopup(html);
      }
    });
    overlays['Fire Ban Districts'] = fireBans;
    refreshLayerControl();
  });

// ======================== Diameter Filter ========================
// ----- Diameter filter (Water Mains only) -----
const diamMinInput = document.getElementById('diamMin');
const applyBtn     = document.getElementById('applyFilter');
const clearBtn     = document.getElementById('clearFilter');

function applyDiameterFilter(){
  const v = Number(diamMinInput.value);
  if (!Number.isFinite(v) || v < 0){
    alert('Enter a non-negative diameter in mm (e.g., 150).');
    return;
  }
  const where = `nominaldiameter >= ${v}`;
  waterMains.setWhere(where, () => {
    whereMap.set('waterMains', where);   // NEW
    scheduleAnalytics?.();
  });
}

function clearDiameterFilter(){
  diamMinInput.value = '';
  waterMains.setWhere('1=1', () => {
    whereMap.delete('waterMains');       // NEW
    scheduleAnalytics?.();
  });
}

applyBtn.addEventListener('click', applyDiameterFilter);
clearBtn.addEventListener('click', clearDiameterFilter);

// Also run filter if user presses Enter in the input
diamMinInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') applyDiameterFilter();
});

// ======================== Analytics (accurate per current view) ========================
function currentBBox() {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
}

// query with intersects + pagination (limit/offset)
async function queryAllFeatures(url, { returnGeometry = true, where = null } = {}) {
  const pageSize = 2000;
  let offset = 0;
  const all = [];

  while (true) {
    const q = L.esri.query({ url });
    q.intersects(map.getBounds());
    q.returnGeometry(returnGeometry);
    if (where && where.trim()) q.where(where);   // NEW
    q.limit(pageSize);
    q.offset(offset);

    const fc = await new Promise((resolve, reject) => {
      q.run((err, featureCollection) => {
        if (err) return reject(err);
        resolve(featureCollection || { type: 'FeatureCollection', features: [] });
      });
    });

    const batch = fc.features || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return { type: 'FeatureCollection', features: all };
}

// sum polyline length (km) inside bbox; also return map by diameter for water mains
function lengthInViewKm(featureCollection, bbox, byDiameterMap = null) {
  if (!featureCollection) return 0;
  const feats = featureCollection.features || [];
  let totalKm = 0;

  for (const f of feats) {
    try {
      if (!f || !f.geometry) continue;
      const addLen = (coords) => {
        const part = { type:'Feature', geometry:{ type:'LineString', coordinates: coords }, properties: f.properties || {} };
        const clipped = turf.bboxClip(part, bbox);
        const km = turf.length(clipped, { units: 'kilometers' });
        totalKm += km;

        if (byDiameterMap) {
          const d = Number(part.properties?.nominaldiameter);
          if (Number.isFinite(d)) byDiameterMap.set(d, (byDiameterMap.get(d) || 0) + km);
        }
      };

      if (f.geometry.type === 'LineString') addLen(f.geometry.coordinates);
      else if (f.geometry.type === 'MultiLineString') {
        for (const coords of f.geometry.coordinates) addLen(coords);
      }
    } catch { /* skip invalid */ }
  }
  return totalKm;
}

let barChart, pieChart;
let analyticsTimer = null;

async function computeAnalytics() {
  const bbox = currentBBox();
  const visible = {
    water: map.hasLayer(waterMains),
    reclaimed: map.hasLayer(reclaimed),
    hydrants: map.hasLayer(hydrantsCluster),
    pHydrants: map.hasLayer(pillarHydCluster)
  };

  const tasks = [];
  const keys = [];

  if (visible.water)     { tasks.push(queryAllFeatures(`${SERVICE_URL}/${LAYER_IDS.waterMains}`,            { where: whereMap.get('waterMains') || null })); keys.push('water'); }
  if (visible.reclaimed) { tasks.push(queryAllFeatures(`${SERVICE_URL}/${LAYER_IDS.reclaimedWaterMains}`,   { where: whereMap.get('reclaimed')   || null })); keys.push('reclaimed'); }
  if (visible.hydrants)  { tasks.push(queryAllFeatures(`${SERVICE_URL}/${LAYER_IDS.hydrants}`,              { returnGeometry:false, where: whereMap.get('hydrants') || null })); keys.push('hydrants'); }
  if (visible.pHydrants) { tasks.push(queryAllFeatures(`${SERVICE_URL}/${LAYER_IDS.pillarHydrants}`,        { returnGeometry:false, where: whereMap.get('pillarHydrants') || null })); keys.push('pHydrants'); }

  const results = await Promise.all(tasks);

  let waterFC=null, recFC=null, hydFC=null, pHydFC=null;
  results.forEach((fc, i) => {
    const k = keys[i];
    if (k === 'water') waterFC = fc;
    if (k === 'reclaimed') recFC = fc;
    if (k === 'hydrants') hydFC = fc;
    if (k === 'pHydrants') pHydFC = fc;
  });

  // lengths and counts
  const byDia = new Map();
  const waterKm = waterFC ? lengthInViewKm(waterFC, bbox, byDia) : 0;
  const recKm   = recFC   ? lengthInViewKm(recFC, bbox) : 0;

  const hydCnt  = hydFC  ? (hydFC.features?.length  || 0) : 0;
  const pHydCnt = pHydFC ? (pHydFC.features?.length || 0) : 0;

  // Summary table
  const tbody = document.querySelector('#summaryTable tbody');
  tbody.innerHTML = `
    <tr><td>Total Water Main length (km)</td><td>${waterKm.toFixed(2)}</td></tr>
    <tr><td>Total Reclaimed Main length (km)</td><td>${recKm.toFixed(2)}</td></tr>
    <tr><td>Hydrants (count)</td><td>${hydCnt}</td></tr>
    <tr><td>Pillar Hydrants (count)</td><td>${pHydCnt}</td></tr>
  `;

  // Length by Diameter table (top 12, desc)
  const rows = Array.from(byDia.entries())
    .sort((a,b) => b[1]-a[1])
    .slice(0, 12);
  const diamBody = document.querySelector('#diamTable tbody');
  diamBody.innerHTML = rows.map(([d, km]) =>
    `<tr><td>${d}</td><td>${km.toFixed(3)}</td></tr>`).join('') || '<tr><td colspan="2">No water mains in view.</td></tr>';

  // Charts
  const barData = {
    labels: ['Water Main (km)', 'Reclaimed Main (km)', 'Hydrants', 'Pillar Hydrants'],
    datasets: [{ label: 'Current view', data: [waterKm, recKm, hydCnt, pHydCnt] }]
  };
  if (!barChart) {
    barChart = new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: barData,
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
  } else { barChart.data = barData; barChart.update(); }

  const pieData = { labels: ['Hydrants', 'Pillar Hydrants'], datasets: [{ data: [hydCnt, pHydCnt] }] };
  if (!pieChart) {
    pieChart = new Chart(document.getElementById('pieChart'), {
      type: 'pie',
      data: pieData,
      options: { responsive:true, maintainAspectRatio:false }
    });
  } else { pieChart.data = pieData; pieChart.update(); }
}
// -----------------------------------
// Attribute Filter Control
// -----------------------------------
function getJSON(url){ return fetch(url).then(r => r.json()); }

// Cache layer fields by key
const fieldCache = new Map();

// Build WHERE with proper quoting for strings/dates
function buildWhere(field, op, value, ftype){
  if (!field || !op) return '1=1';
  if (value == null || value === '') return `${field} ${op} NULL`; // simple edge case

  const isString = /^(esriFieldTypeString)$/i.test(ftype);
  const isDate   = /^(esriFieldTypeDate)$/i.test(ftype);
  const isLike   = op.toUpperCase() === 'LIKE';

  if (isString){
    const v = String(value).replace(/'/g,"''");
    return `${field} ${op} '${isLike ? `%${v}%` : v}'`;
  }
  if (isDate){
    // Expect yyyy-mm-dd; convert to epoch milliseconds for ArcGIS REST
    const t = Date.parse(value);
    if (Number.isFinite(t)) return `${field} ${op} ${t}`;
    return `${field} ${op} NULL`;
  }
  // numeric and others
  return `${field} ${op} ${value}`;
}

async function loadFieldsFor(key){
  if (fieldCache.has(key)) return fieldCache.get(key);

  const lyrId = KEY_TO_ID[key];          // <- use the explicit map
  if (lyrId == null) return [];

  const meta = await getJSON(`${SERVICE_URL}/${lyrId}?f=json`);
  const fields = (meta.fields || []).filter(f =>
    !['esriFieldTypeGeometry','esriFieldTypeOID'].includes(f.type)
  );
  fieldCache.set(key, fields);
  return fields;
}

// Create a Leaflet control with our form
const FilterCtl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd: function(){
    const div = L.DomUtil.create('div', 'leaflet-control filterctl');
    div.innerHTML = `
      <label>Layer</label>
      <select id="fLayer">
        <option value="waterMains">Water Mains</option>
        <option value="reclaimed">Reclaimed Water Mains</option>
        <option value="hydrants">Hydrants</option>
        <option value="pillarHydrants">Pillar Hydrants</option>
        <option value="wwGravity">WW Gravity</option>
        <option value="wwLowPressure">WW Low Pressure</option>
        <option value="wwPumping">WW Pumping</option>
        <option value="wwVacuum">WW Vacuum</option>
      </select>

      <label>Field</label>
      <select id="fField"></select>

      <div class="row">
        <div>
          <label>Operator</label>
          <select id="fOp">
            <option>=</option><option>!=</option>
            <option>&gt;</option><option>&gt;=</option>
            <option>&lt;</option><option>&lt;=</option>
            <option>LIKE</option>
          </select>
        </div>
        <div>
          <label>Value</label>
          <input id="fVal" placeholder="e.g. 150 or text">
        </div>
      </div>

      <div class="btns">
        <button id="fApply" class="primary" type="button">Apply</button>
        <button id="fClear" type="button">Clear</button>
      </div>
      <div class="hint" id="fHint">Tip: for LIKE, value will be wrapped in %value%.</div>
    `;

    // Prevent map drag when interacting with the form
    L.DomEvent.disableClickPropagation(div);

    const fLayer = div.querySelector('#fLayer');
    const fField = div.querySelector('#fField');
    const fOp    = div.querySelector('#fOp');
    const fVal   = div.querySelector('#fVal');
    const fApply = div.querySelector('#fApply');
    const fClear = div.querySelector('#fClear');
    const fHint  = div.querySelector('#fHint');

    async function populateFields(){
      const key = fLayer.value;
      const fields = await loadFieldsFor(key);
      fField.innerHTML = fields.map(f => `<option value="${f.name}" data-type="${f.type}">${f.name}</option>`).join('');
    }

    function apply(){
      const key = fLayer.value;
      const lyr = layerRegistry[key];
      if (!lyr){ alert('Layer not found.'); return; }

      const opt = fField.selectedOptions[0];
      const fName = opt?.value;
      const fType = opt?.dataset?.type || '';
      const clause = buildWhere(fName, fOp.value, fVal.value, fType);

      lyr.setWhere(clause, () => {
        whereMap.set(key, clause);   // remember for analytics
        scheduleAnalytics?.();
      });
      fHint.textContent = `Applied: ${clause}`;
    }

    function clear(){
      const key = fLayer.value;
      const lyr = layerRegistry[key];
      if (lyr){
        lyr.setWhere('1=1', () => {
          whereMap.delete(key);
          scheduleAnalytics?.();
        });
      }
      fVal.value = '';
      fHint.textContent = 'Cleared filter.';
    }

    fLayer.addEventListener('change', populateFields);
    fApply.addEventListener('click', apply);
    fClear.addEventListener('click', clear);

    // initial
    populateFields().then(() => tryApplyFromURL(fLayer, fField, fOp, fVal, fHint));

    return div;
  }
});
map.addControl(new FilterCtl());
function getURLParams(){
  const p = new URLSearchParams(location.search);
  return {
    layer: p.get('layer') || null,
    where: p.get('where') || null,
    field: p.get('field') || null,
    op:    p.get('op')    || null,
    value: p.get('value') || null
  };
}

async function tryApplyFromURL(fLayer, fField, fOp, fVal, fHint){
  const { layer, where, field, op, value } = getURLParams();
  if (!layer) return;

  // set layer select
  if (layerRegistry[layer]) fLayer.value = layer;

  // ensure fields are loaded for this layer
  const fields = await loadFieldsFor(layer);
  fField.innerHTML = fields.map(f => `<option value="${f.name}" data-type="${f.type}">${f.name}</option>`).join('');

  if (where){
    layerRegistry[layer].setWhere(where, () => {
      whereMap.set(layer, where);
      scheduleAnalytics?.();
    });
    fHint.textContent = `Applied (URL): ${where}`;
    return;
  }

  if (field && op && (value !== null)){
    fField.value = field;
    fOp.value = op;
    fVal.value = value;
    const fType = (fields.find(x => x.name === field) || {}).type || '';
    const clause = buildWhere(field, op, value, fType);
    layerRegistry[layer].setWhere(clause, () => {
      whereMap.set(layer, clause);
      scheduleAnalytics?.();
    });
    fHint.textContent = `Applied (URL): ${clause}`;
  }
}

// debounce & hooks
function scheduleAnalytics() {
  if (analyticsTimer) clearTimeout(analyticsTimer);
  analyticsTimer = setTimeout(computeAnalytics, 350);
}
map.on('moveend', scheduleAnalytics);
document.getElementById('refreshBtn').addEventListener('click', computeAnalytics);

// overlay add/remove -> recompute
[waterMains, reclaimed, hydrantsCluster, pillarHydCluster, wwGravity, wwLowPressure, wwPumping, wwVacuum]
  .forEach(layer => layer.on('add remove', () => { updateScaleHint(); scheduleAnalytics(); }));

map.whenReady(() => { updateScaleHint(); scheduleAnalytics(); });
