// ===========================
// 1. BASE LAYERS
// ===========================

// Satelitska podloga (Esri)
const esriSatelit = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles © Esri, i ostali pružatelji",
  }
);

// OpenStreetMap podloga
const osm = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "© OpenStreetMap doprinositelji",
  }
);

// ===========================
// 2. INICIJALIZACIJA MAPE
// ===========================
const map = L.map("map", {
  center: [45.8, 16.0],
  zoom: 7,
  layers: [esriSatelit], // default podloga
});

L.control.zoom({ position: "topleft" }).addTo(map);

// ===========================
// 3. LAYER ZA ŠKOLE
// ===========================
let schoolsLayer = null;           // ovdje će ići svi poligoni + točke
const layersByIndex = {};          // index -> Leaflet layer
let geojsonData = null;            // spremimo si cijeli GeoJSON
const select = document.getElementById("schoolSelect");

// helper za boju po županiji (uvijek ista boja za isto ime)
function getCountyColor(zupanija) {
  if (!zupanija) return "#3388ff";
  let hash = 0;
  for (let i = 0; i < zupanija.length; i++) {
    hash = zupanija.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = (hash % 360 + 360) % 360; // 0–359
  return `hsl(${hue}, 70%, 55%)`;
}

// ===========================
// 4. UČITAVANJE merged_schools.geojson
// ===========================
fetch("merged_schools.geojson")
  .then((res) => {
    if (!res.ok) {
      throw new Error("Ne mogu učitati merged_schools.geojson");
    }
    return res.json();
  })
  .then((data) => {
    geojsonData = data;

    // dodaj index u properties, da ga znamo kasnije
    data.features.forEach((f, i) => {
      if (!f.properties) f.properties = {};
      f.properties._idx = i;
    });

    // napravi Leaflet GeoJSON layer
    schoolsLayer = L.geoJSON(data, {
      style: (feature) => {
        const g = feature.geometry;
        const props = feature.properties || {};
        const color = getCountyColor(props.zupanija);

        // stil za poligone / multipoligone
        if (g && (g.type === "Polygon" || g.type === "MultiPolygon")) {
          return {
            color: color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.4,
          };
        }

        // za točke style vraćaš samo za svaki slučaj (ne koristi se jer koristimo pointToLayer)
        return {
          color: color,
        };
      },
      pointToLayer: (feature, latlng) => {
        const props = feature.properties || {};
        const color = getCountyColor(props.zupanija);
        // kružić za škole koje su samo točka
        return L.circleMarker(latlng, {
          radius: 6,
          color: "#000",
          weight: 1,
          fillColor: color,
          fillOpacity: 0.9,
        });
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const i = props._idx;

        const naziv = props.naziv || "Nepoznata škola";
        const mjesto = props.mjesto || "";
        const adresa = props.adresa || "";
        const zup = props.zupanija || "";

        const htmlPopup = `
          <b>${naziv}</b><br/>
          ${adresa ? adresa + "<br/>" : ""}
          ${mjesto ? mjesto + "<br/>" : ""}
          ${zup}
        `;

        layer.bindPopup(htmlPopup.trim());
        layersByIndex[i] = layer;

        // napuni dropdown
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = naziv;
        select.appendChild(opt);
      },
    }).addTo(map);

    // centriraj na sve škole
    if (schoolsLayer.getBounds().isValid()) {
      map.fitBounds(schoolsLayer.getBounds(), { padding: [30, 30] });
    }
  })
  .catch((err) => {
    console.error("Greška pri učitavanju merged_schools.geojson:", err);
    alert("Ne mogu učitati merged_schools.geojson. Pogledaj Console u pregledniku za detalje.");
  });

// ===========================
// 5. ODABIR ŠKOLE IZ DROPDOWNA
// ===========================
select.addEventListener("change", function () {
  const value = this.value;
  if (value === "") return;

  const idx = parseInt(value, 10);
  const layer = layersByIndex[idx];
  if (!layer) return;

  // ako je poligon/multipoligon -> fitBounds
  if (layer.getBounds && layer.getBounds().isValid()) {
    map.fitBounds(layer.getBounds(), { padding: [40, 40] });
  } else if (layer.getLatLng) {
    // ako je točka
    map.setView(layer.getLatLng(), 18);
  }

  layer.openPopup();
});

// ===========================
// 6. LAYER KONTROLA (podloge + škole)
// ===========================
const baseLayers = {
  "Satelitska karta (Esri)": esriSatelit,
  "OpenStreetMap": osm,
};

const overlays = {
  "Škole – poligoni/točke": () => {}, // placeholder, pravi layer dodamo kad se učita
};

// kad se GeoJSON učita, dodamo ga u kontrolu slojeva
// (malo hacky, ali jednostavno)
let layersControl = L.control.layers(baseLayers, null, { collapsed: false }).addTo(map);
const addSchoolsToControl = setInterval(() => {
  if (schoolsLayer) {
    layersControl.addOverlay(schoolsLayer, "Škole – poligoni/točke");
    clearInterval(addSchoolsToControl);
  }
}, 200);



