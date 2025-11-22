// ==============================
// 1. GLOBALNE VARIJABLE I TRAGOVI
// ==============================

let clues = {
    1: "Ravnateljica je viđena je na mjestu gdje je pola polja sivo, a pola zeleno. Pogledajte pažljivo — gdje se te boje miješaju na snimci iz zraka? Klikni na polje!",
    2: "Hej, detektivi! Nestala ravnateljica zadnji put je viđena kako se iskrada iz škole i ulazi u neku kuću! Vaš zadatak: Pronađite sve kuće koje su udaljene maksimalno 300 metara od škole.",
    3: "Nestala ravnateljica voli obilaziti trgovine! Vaš zadatak: Pronađite u kojoj od ovih kuća se krije trgovina!",
    4: "Oh, ne. Zamalo... Nestala ravnateljica upravo je izašla je iz trgovine. Viđena je kako se odmara na livadi u blizini. Vaš zadatak: Detektiraj sve livade u blizini trgovine.",
    5: "Pozor, detektivi! Netko je pronašao knjigu nestale ravnateljice u udobnom zelenom kutku unutar odabranih livada. Vaš zadatak: Od svih livada pronađite tri najmanje!",
    6: "Bravo, detektivi! Ravnateljica više nema gdje pobjeći – vaša detektivska vještina je nepogrešiva! Ššš... pažljivo slušajte! Nestala ravnateljica može čuti ptice kako pjevaju. Vaš zadatak: Pronađite najmanju livadu okruženu s najviše drveća.",
    7: "Sjajan posao, detektivi! Riješili ste zagonetku i otkrili livadu na kojoj se krije vaša ravnateljica. Ali gdje točno na toj livadi? 🔍",
    8: "Na livadi se krije ključ, a da ga otkrijete, kliknite na pravo mjesto – neka vam karta pokaže gdje!"
};

let hasReadClue8 = false;
let clicksOnGreenSpacesEnabled = false;

let currentClue = 1;

// ==============================
// 2. MAPA I SLOJEVI
// ==============================

let map;
let schoolLayer = L.layerGroup();
let greenAreaLayer = L.layerGroup();
let storeLayer = L.layerGroup();
let buildingLayer = L.layerGroup();
let bufferLayer = L.layerGroup();
let treesLayer = L.layerGroup();
let filteredBuildings = L.layerGroup();
let filteredShops = L.layerGroup();
let filteredGreenSpaces = L.layerGroup();
let drawnItems;
let drawControl;
let hasZoomedToBounds = false;

let treeClickCounter = 0;
let highlightedTrees = [];
let selectedBufferDistance = null;

// ==============================
// 3. INIT – kad se stranica učita
// ==============================

document.addEventListener("DOMContentLoaded", () => {
    // 3.1. Pripremi dropdown umjesto input šifre
    const form = document.getElementById("loginForm");
    const codeInput = document.getElementById("code");

    const schoolSelect = document.createElement("select");
    schoolSelect.id = "schoolSelect";
    schoolSelect.innerHTML = `<option value="">-- Odaberi svoju školu --</option>`;
    schoolSelect.style.marginBottom = "20px";

    // ubaci select prije code inputa
    form.insertBefore(schoolSelect, codeInput);
    // sakrij stari input za šifru
    codeInput.style.display = "none";

    // 3.2. Učitaj škole iz TVOG GeoJSON-a
    loadSchoolsIntoDropdown();

    // 3.3. Kad korisnik klikne na "Otključaj!"
    form.addEventListener("submit", handleSchoolSelection);

    // 3.4. Aktiviraj gumbe za tragove
    setupClueButtons();

    // 3.5. Aktiviraj toolbox gumbe
    setupToolboxButtons();
});

// ==============================
// 4. UČITAVANJE ŠKOLA U DROPDOWN
// ==============================

function loadSchoolsIntoDropdown() {
    const url = "https://raw.githubusercontent.com/marburic/escapeClassroom/main/schools.geojson";

    fetch(url)
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById("schoolSelect");
            if (!select) return;

            // sortiraj škole po nazivu
            const features = (data.features || []).slice().sort((a, b) => {
                const aName = (a.properties?.naziv || "").toLowerCase();
                const bName = (b.properties?.naziv || "").toLowerCase();
                if (aName < bName) return -1;
                if (aName > bName) return 1;
                return 0;
            });

            features.forEach(f => {
                if (!f.geometry || !f.geometry.coordinates) return;
                const coords = f.geometry.coordinates; // [lon, lat]

                const naziv = f.properties?.naziv || "Bez naziva";
                const mjesto = f.properties?.mjesto || "";

                const opt = document.createElement("option");
                opt.value = JSON.stringify([coords[1], coords[0]]); // [lat, lon]
                opt.textContent = mjesto ? `${naziv} (${mjesto})` : naziv;
                select.appendChild(opt);
            });
        })
        .catch(err => {
            console.error("Greška pri učitavanju schools.geojson:", err);
        });
}

// ==============================
// 5. KAD ODABERU ŠKOLU I KLIKNU "OTKLJUČAJ!"
// ==============================

function handleSchoolSelection(event) {
    event.preventDefault();
    const select = document.getElementById("schoolSelect");
    const errorMessage = document.getElementById("errorMessage");

    if (!select || !select.value) {
        errorMessage.textContent = "Odaberi svoju školu iz popisa, detektivi!";
        return;
    }

    errorMessage.textContent = "";

    const coords = JSON.parse(select.value); // [lat, lon]
    const lat = coords[0];
    const lng = coords[1];

    // pokreni kartu na odabranoj školi
    initMap(lat, lng);

    // sakrij početni ekran, pokaži kartu, toolbox i tragove
    document.querySelector(".container").style.display = "none";
    document.getElementById("map").style.display = "block";
    document.getElementById("toolbox").style.display = "block";
    document.getElementById("clueSection").style.display = "block";

    showFunnyMessage(
        "Čestitamo, detektivi! 🕵️‍♀️🔓 Odabrali ste svoju školu i potraga može početi! 🌍 Pratite tragove, riješite zagonetke i otkrijte gdje se skriva ravnateljica! 🎉"
    );
}

// ==============================
// 6. INICIJALIZACIJA KARTE I SLOJEVA
// ==============================

function initMap(lat, lng) {
    console.log("Init map at:", lat, lng);

    map = L.map("map", { zoomControl: false }).setView([lat, lng], 16);

    L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            attribution: "&copy; Esri, USGS, NOAA"
        }
    ).addTo(map);

    // ŠKOLE – sada tvoj schools.geojson (svi punktovi)
    fetchGeoJSON(
        "https://raw.githubusercontent.com/marburic/escapeClassroom/main/schools.geojson",
        schoolLayer,
        onEachSchoolFeature,
        {
            color: "#ff0000",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.2,
            fillColor: "#ff0000"
        }
    );

    // Ostali slojevi ostaju kao u originalu (za sada još vezani uz Mariju Goricu)
    fetchGeoJSON(
        "https://raw.githubusercontent.com/akuvezdic/DIRECTORS/main/green_areas_wgs.geojson",
        greenAreaLayer,
        null,
        {
            color: "#00ff00",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.2,
            fillColor: "#00ff00"
        }
    );

    fetchGeoJSON(
        "https://raw.githubusercontent.com/akuvezdic/DIRECTORS/main/shops_wgs.geojson",
        storeLayer,
        onEachShopFeature,
        {
            color: "#0000ff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.2,
            fillColor: "#0000ff"
        }
    );

    fetchGeoJSON(
        "https://raw.githubusercontent.com/akuvezdic/DIRECTORS/main/kuce.geojson",
        buildingLayer,
        null,
        {
            color: "#ffff00",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.2,
            fillColor: "#ffff00"
        }
    );

    // Drveće – klik za brojač
    fetchGeoJSON(
        "https://raw.githubusercontent.com/akuvezdic/DIRECTORS/main/drvece_wgs.geojson",
        treesLayer,
        function (feature, layer) {
            layer.on("click", function (e) {
                highlightTree(layer);
                incrementCounter();
                e.originalEvent.stopPropagation();
            });
        },
        {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: "#32CD32",
                    color: "#006400",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            }
        }
    );

    const overlayMaps = {
        Škola: schoolLayer,
        Livade: greenAreaLayer,
        Trgovine: storeLayer,
        Kuće: buildingLayer,
        Drveće: treesLayer
    };

    L.control.layers(null, overlayMaps).addTo(map);

    // mreža i logika za "točan klik" (još uvijek vezano uz original bounds)
    fetchGeoJSONForBounds(map);

    window.addEventListener("resize", () => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 0);
}

// ==============================
// 7. POMOĆNE FUNKCIJE ZA GEOJSON
// ==============================

function fetchGeoJSON(url, layerGroup, onEachFeature, options = {}) {
    fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            L.geoJSON(data, {
                onEachFeature: onEachFeature,
                ...options
            }).addTo(layerGroup);
        })
        .catch((error) => {
            console.error("Error fetching GeoJSON data:", error);
        });
}

function fetchGeoJSONForBounds(map) {
    fetch("https://raw.githubusercontent.com/akuvezdic/DIRECTORS/main/mreza_wgs.geojson")
        .then((response) => {
            if (!response.ok) throw new Error("Network not ok");
            return response.json();
        })
        .then((data) => {
            L.geoJSON(data, {
                style: () => ({
                    color: "white",
                    weight: 1
                })
            }).addTo(map);

            const correctBounds = [
                [45.909, 15.724],
                [45.912, 15.727]
            ];

            map.on("click", function (e) {
                if (!isWithinBounds(e.latlng, correctBounds)) {
                    showMessage("Oops! Pokušajte ponovno, detektivi!");
                } else if (!hasZoomedToBounds) {
                    const bounds = L.latLngBounds(correctBounds);
                    map.fitBounds(bounds);
                    hasZoomedToBounds = true;
                    showSuccessMessage("Točno! Bravo, detektivi!");
                }
            });
        })
        .catch((err) => console.error(err));
}

function isWithinBounds(latlng, bounds) {
    const sw = bounds[0];
    const ne = bounds[1];
    return (
        latlng.lat >= sw[0] &&
        latlng.lat <= ne[0] &&
        latlng.lng >= sw[1] &&
        latlng.lng <= ne[1]
    );
}

// ==============================
// 8. TOOLBOX – GUMBI I FUNKCIJE
// ==============================

function setupToolboxButtons() {
    // brojač drveća – otvori/zatvori
    document.getElementById("treeCounterButton").addEventListener("click", function () {
        const counterSection = document.getElementById("counterSection");
        if (counterSection.style.display === "none" || counterSection.style.display === "") {
            counterSection.style.display = "block";
        } else {
            counterSection.style.display = "none";
        }
    });

    document
        .getElementById("resetCounterButton")
        .addEventListener("click", resetCounter);

    document
        .getElementById("filterBuildingsButton")
        .addEventListener("click", filterBuildings);

    document
        .getElementById("filterShopsButton")
        .addEventListener("click", filterShops);

    document
        .getElementById("filterGreenSpacesButton")
        .addEventListener("click", filterGreenSpaces);

    document
        .getElementById("clearMapButton")
        .addEventListener("click", clearMap);

    // buffer gumb
    document
        .getElementById("createBufferButton")
        .addEventListener("click", toggleBufferModal);

    // odabir udaljenosti za buffer
    document
        .getElementById("bufferDistance")
        .addEventListener("change", handleBufferDistanceChange);
}

function filterBuildings() {
    map.eachLayer((layer) => {
        if (layer !== bufferLayer && !(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });

    filteredBuildings.clearLayers();

    fetch(
        "https://raw.githubusercontent.com/akuvezdic/DIRECTORS/main/corrected_intersection_300m_wgs.geojson"
    )
        .then((response) => {
            if (!response.ok) throw new Error("Network not ok");
            return response.json();
        })
        .then((data) => {
            L.geoJSON(data, {
                style: {
                    color: "#ff7800",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.5,
                    fillColor: "#ff7800"
                }
            }).addTo(filteredBuildings);

            filteredBuildings.addTo(map);
        })
        .catch((err) =>
            console.error("Error fetching filtered buildings GeoJSON data:", err)
        );
}

function filterShops() {
    map.eachLayer((layer) => {
        if (layer !== bufferLayer && !(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });
    filteredShops.clearLayers();
    storeLayer.addTo(map);
}

function filterGreenSpaces() {
    map.eachLayer((layer) => {
        if (layer !== bufferLayer && !(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });

    filteredGreenSpaces.clearLayers();

    fetch(
        "https://raw.githubusercontent.com/akuvezdic/DIRECTORS/main/zelene%20povrsine%20u%20blizini%20trgovina.geojson"
    )
        .then((response) => {
            if (!response.ok) throw new Error("Network not ok");
            return response.json();
        })
        .then((data) => {
            L.geoJSON(data, {
                style: {
                    color: "#006400",
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 0.5,
                    fillColor: "#00ff00"
                }
            }).addTo(filteredGreenSpaces);

            filteredGreenSpaces.addTo(map);
        })
        .catch((err) =>
            console.error("Error fetching green spaces GeoJSON data:", err)
        );
}

function clearMap() {
    map.eachLayer(function (layer) {
        if (layer !== bufferLayer && !(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });
}

// BUFFER STVARI

function toggleBufferModal() {
    const bufferModal = document.getElementById("bufferDistanceModal");
    if (bufferModal.style.display === "none" || bufferModal.style.display === "") {
        bufferModal.style.display = "block";
    } else {
        bufferModal.style.display = "none";
    }
}

function handleBufferDistanceChange() {
    const selectedValue = this.value;
    const bufferMessage = document.getElementById("bufferMessage");

    bufferMessage.textContent = "";
    bufferMessage.classList.remove("valid", "invalid");

    if (selectedValue === "300") {
        bufferMessage.textContent = "Odlično! Sada klikni na školu i iscrtaj buffer.";
        bufferMessage.classList.add("valid");
        selectedBufferDistance = 300;
    } else if (selectedValue === "400" || selectedValue === "500") {
        bufferMessage.textContent = "Pogrešna udaljenost! Pokušaj ponovno...";
        bufferMessage.classList.add("invalid");
        selectedBufferDistance = null;
    } else {
        selectedBufferDistance = null;
    }
}

function onEachSchoolFeature(feature, layer) {
    layer.on("click", function () {
        if (selectedBufferDistance === 300) {
            const bufferedFeature = turf.buffer(feature, 0.3, { units: "kilometers" });

            bufferLayer.clearLayers();

            L.geoJSON(bufferedFeature, {
                style: {
                    color: "#3388ff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.4,
                    fillColor: "#3388ff"
                }
            }).addTo(bufferLayer);

            bufferLayer.addTo(map);
            map.fitBounds(bufferLayer.getBounds(), { padding: [50, 50] });

            document.getElementById("bufferDistanceModal").style.display = "none";
        } else {
            alert("Prvo odaberi točnu udaljenost (300 m) za buffer.");
        }
    });
}

// ==============================
// 9. DRVEĆE – BROJANJE I STIL
// ==============================

function highlightTree(layer) {
    layer.setStyle({
        color: "#FFD700",
        fillColor: "#FFD700",
        weight: 3,
        radius: 6
    });
    highlightedTrees.push(layer);
}

function unhighlightAllTrees() {
    highlightedTrees.forEach((layer) => {
        layer.setStyle({
            color: "#006400",
            fillColor: "#32CD32",
            weight: 1,
            radius: 4
        });
    });
    highlightedTrees = [];
}

function incrementCounter() {
    treeClickCounter++;
    document.getElementById("treeCounter").textContent = treeClickCounter;
}

function resetCounter() {
    treeClickCounter = 0;
    document.getElementById("treeCounter").textContent = treeClickCounter;
    unhighlightAllTrees();
}

// ==============================
// 10. SHOP BUFFER
// ==============================

function onEachShopFeature(feature, layer) {
    layer.on("click", function () {
        const shopBuffer = turf.buffer(feature, 0.2, { units: "kilometers" });

        bufferLayer.clearLayers();
        L.geoJSON(shopBuffer, {
            style: {
                color: "#ff7800",
                weight: 2,
                opacity: 1,
                fillOpacity: 0.4,
                fillColor: "#ff7800"
            }
        }).addTo(bufferLayer);

        bufferLayer.addTo(map);
    });
}

// ==============================
// 11. TRAGOVI (CLUES)
// ==============================

function setupClueButtons() {
    // početno – samo prvi trag aktivan
    document.querySelectorAll(".clue-btn").forEach((button) => {
        const n = parseInt(button.getAttribute("data-clue"), 10);
        if (n === 1) {
            button.disabled = false;
            button.style.opacity = "1";
        } else {
            button.disabled = true;
            button.style.opacity = "0.5";
        }
    });

    document.querySelectorAll(".clue-btn").forEach((button) => {
        button.addEventListener("click", function () {
            const clueNumber = parseInt(this.getAttribute("data-clue"), 10);
            const clueDisplay = document.getElementById("clueDisplay");
            clueDisplay.textContent = clues[clueNumber];

            document.querySelectorAll(".clue-btn").forEach((btn) => {
                btn.style.backgroundColor = "#F3326E";
            });
            this.style.backgroundColor = "#95DA14";

            // ako je 8. trag, označi da može klikati po livadama
            if (clueNumber === 8) {
                hasReadClue8 = true;
                clicksOnGreenSpacesEnabled = true;
            }
        });
    });
}

function enableNextClue() {
    currentClue++;
    const nextClueButton = document.querySelector(
        `.clue-btn[data-clue="${currentClue}"]`
    );
    if (nextClueButton) {
        nextClueButton.disabled = false;
        nextClueButton.style.opacity = "1";
    }
}

// ==============================
// 12. PORUKE (TOASTOVI, FUNNY MSG)
// ==============================

function showMessage(text) {
    const messageElement = document.getElementById("message");
    messageElement.textContent = text;
    messageElement.style.display = "block";
    setTimeout(() => {
        messageElement.style.display = "none";
    }, 3000);
}

function showSuccessMessage(text) {
    const messageElement = document.createElement("div");
    messageElement.textContent = text;
    messageElement.style.backgroundColor = "#95DA14";
    messageElement.style.color = "white";
    messageElement.style.padding = "10px";
    messageElement.style.borderRadius = "4px";
    messageElement.style.position = "fixed";
    messageElement.style.top = "20px";
    messageElement.style.left = "50%";
    messageElement.style.transform = "translateX(-50%)";
    messageElement.style.zIndex = "9999";
    messageElement.style.fontSize = "22px";
    document.body.appendChild(messageElement);

    setTimeout(() => {
        messageElement.style.display = "none";
    }, 3000);
}

function showFunnyMessage(text) {
    const funnyMessageElement = document.getElementById("funnyMessage");
    funnyMessageElement.textContent = text;
    funnyMessageElement.classList.add("show");
    funnyMessageElement.onclick = () => {
        funnyMessageElement.classList.remove("show");
    };
}

