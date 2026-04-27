const axios = require('axios');
const fs = require('fs');

async function archiverDonnees() {
    const STATIONS = [
        { id: "70:ee:50:a9:7c:b0", nom: "Varanges" },
        {
            id: "70:ee:50:71:3d:00", // Genlis 1 (Principale)
            nom: "Genlis",
            secoursId: "70:ee:50:2b:56:da" // Genlis 2 (Secours)
        }
    ];

    try {
        // 1. Authentification
        const authParams = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.NETATMO_CLIENT_ID,
            client_secret: process.env.NETATMO_CLIENT_SECRET,
            refresh_token: process.env.NETATMO_REFRESH_TOKEN
        });

        const authRes = await axios.post('https://api.netatmo.com/oauth2/token', authParams);
        const token = authRes.data.access_token;

        // 2. Récupération des données
        const res = await axios.get('https://api.netatmo.com/api/getpublicdata', {
            params: {
                lat_ne: 47.60, lon_ne: 5.60,
                lat_sw: 46.90, lon_sw: 4.90
            },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const toutesLesStations = res.data.body || [];
        // --- LIGNE DE TEST À AJOUTER ICI ---
        console.log(`🔍 Stations trouvées dans la zone : ${toutesLesStations.map(s => s._id).join(', ')}`);
        // -----------------------------------
        // 3. Formatage de la date en UTC
        const now = new Date();
        const dateUTC = now.toISOString().split('T')[0].split('-').reverse().join('/');
        const heureUTC = now.toISOString().split('T')[1].substring(0, 5);

        STATIONS.forEach(cible => {
            // Tentative de trouver la station principale
            let dataStation = toutesLesStations.find(s => s._id === cible.id);
            let utiliseSecours = false;

            // Logique de repli : si absente, on cherche le secours
            if (!dataStation && cible.secoursId) {
                dataStation = toutesLesStations.find(s => s._id === cible.secoursId);
                utiliseSecours = true;
            }

            if (dataStation) {
                let temp = "N/A", hum = "N/A", pluie_1h = 0, pluie_24h = 0;
                const measures = dataStation.measures || {};

                for (const key in measures) {
                    const m = measures[key];
                    if (m.type && m.res) {
                        const resKey = Object.keys(m.res)[0];
                        const values = m.res[resKey];
                        m.type.forEach((typeStr, index) => {
                            const val = Array.isArray(values) ? values[index] : values;
                            if (typeStr === "temperature") temp = val;
                            if (typeStr === "humidity") hum = val;
                        });
                    }
                    if (m.rain_60min !== undefined) pluie_1h = Math.round(m.rain_60min * 100) / 100;
                    if (m.rain_24h !== undefined) pluie_24h = Math.round(m.rain_24h * 100) / 100;
                }

                const ligne = `${dateUTC};${heureUTC};${cible.nom};${temp};${hum};${pluie_1h};${pluie_24h}\n`;
                fs.appendFileSync('historique.csv', ligne);

                const statut = utiliseSecours ? " (via SECOURS)" : "";
                console.log(`✅ ${cible.nom}${statut} archivé à ${heureUTC} UTC (${temp}°C)`);
            } else {
                console.log(`⚠️ Station ${cible.nom} (et son secours) absente du flux public.`);
            }
        });

    } catch (error) {
        if (error.response && error.response.status === 403) {
            console.error("❌ Erreur 403 : Accès refusé par Netatmo (Rate limit probable).");
            process.exit(0);
        } else {
            console.error("❌ Erreur critique :", error.message);
            process.exit(1);
        }
    }
}

archiverDonnees();