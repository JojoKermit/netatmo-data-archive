const axios = require('axios');
const fs = require('fs');

async function archiverDonnees() {
    const STATIONS = [
        { id: "70:ee:50:a9:7c:b0", nom: "Varanges" },
        { id: "70:ee:50:71:3d:00", nom: "Genlis" }
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

        // 2. Récupération des données (Zone Varanges/Genlis)
        const res = await axios.get('https://api.netatmo.com/api/getpublicdata', {
            params: {
                lat_ne: 47.30, lon_ne: 5.30,
                lat_sw: 47.15, lon_sw: 5.10
            },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const toutesLesStations = res.data.body || [];

        // 3. Formatage de la date en UTC
        const now = new Date();
        const dateUTC = now.toISOString().split('T')[0].split('-').reverse().join('/'); // JJ/MM/AAAA
        const heureUTC = now.toISOString().split('T')[1].substring(0, 5); // HH:mm

        STATIONS.forEach(cible => {
            const dataStation = toutesLesStations.find(s => s._id === cible.id);

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
                console.log(`✅ ${cible.nom} archivé à ${heureUTC} UTC (${temp}°C)`);
            } else {
                console.log(`⚠️ Station ${cible.nom} absente du flux public.`);
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
} // <--- C'est cette accolade qui devait manquer

archiverDonnees();