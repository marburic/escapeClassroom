// Kad se stranica učita...
document.addEventListener("DOMContentLoaded", () => {
    // 1) napuni dropdown sa školama
    loadSchoolsIntoDropdown();

    // 2) kad korisnik klikne "Kreni!"
    document.getElementById("loginForm").addEventListener("submit", handleSchoolSelection);
});

// Učitavanje popisa škola iz GeoJSON-a
function loadSchoolsIntoDropdown() {
    fetch('https://raw.githubusercontent.com/akuvezdic/DIRECTORS/main/schools_wgs.geojson')
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById("schoolSelect");

            data.features.forEach(feature => {
                const coords = feature.geometry.coordinates;  // [lon, lat]
                const name = feature.properties.NAZIV || "Škola";

                const option = document.createElement("option");
                option.value = JSON.stringify(coords); // spremimo koordinate kao tekst
                option.textContent = name;
                select.appendChild(option);
            });
        })
        .catch(err => console.error("Greška pri učitavanju škola:", err));
}

// Kad korisnik pritisne "Kreni!"
function handleSchoolSelection(e) {
    e.preventDefault(); // spriječi reload stranice

    const selectedValue = document.getElementById("schoolSelect").value;

    if (!selectedValue) {
        document.getElementById("errorMessage").textContent = "Molimo odaberite školu!";
        return;
    }

    const coords = JSON.parse(selectedValue);
    const lat = coords[1];
    const lng = coords[0];

    // Sakrij početni ekran
    document.querySelector(".container").style.display = "none";
    // Prikaži kartu
    document.getElementById("map").style.display = "block";

    initMap(lat, lng);
}

let map;

// Inicijalizacija karte
function initMap(lat, lng) {
    map = L.map("map").setView([lat, lng], 16);

    // Pozadinska karta (satelitska)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, USGS, NOAA'
    }).addTo(map);
}
