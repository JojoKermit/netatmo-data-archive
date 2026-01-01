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

        // 2. Récupération des données (Zone légèrement élargie)
        const res = await axios.get('https://api.netatmo.com/api/getpublicdata', {
            params: {
                lat_ne: 47.30, lon_ne: 5.30,
                lat_sw: 47.15, lon_sw: 5.10
            },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const toutesLesStations = res.data.body || [];
        const maintenant = new Date();
        const dateLoc = maintenant.toLocaleDateString('fr-FR');
        const heureLoc = maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        STATIONS.forEach(cible => {
            const dataStation = toutesLesStations.find(s => s._id === cible.id);

            if (dataStation) {
                let temp = "N/A", hum = "N/A", pluie_1h = 0, pluie_24h = 0;

                // Sécurité pour la lecture des mesures
                if (dataStation.measures) {
                    const firstTs = Object.keys(dataStation.measures)[0];
                    if (firstTs && dataStation.measures[firstTs].res) {
                        const resKey = Object.keys(dataStation.measures[firstTs].res)[0];
                        const values = dataStation.measures[firstTs].res[resKey];
                        if (values) {
                            temp = values[0] !== undefined ? values[0] : "N/A";
                            hum = values[1] !== undefined ? values[1] : "N/A";
                        }
                    }
                }

                // Pluie
                if (dataStation.modules) {
                    dataStation.modules.forEach(m => {
                        if (m.type === "NAModule3" && m.measures) {
                            pluie_1h = m.measures.rain_60min || 0;
                            pluie_24h = m.measures.rain_24h || 0;
                        }
                    });
                }

                const ligne = `${dateLoc};${heureLoc};${cible.nom};${temp};${hum};${pluie_1h};${pluie_24h}\n`;
                fs.appendFileSync('historique.csv', ligne);
                console.log(`✅ ${cible.nom} traité (${temp}°C)`);
            } else {
                console.log(`⚠️ Station ${cible.nom} non trouvée dans la zone actuelle.`);
            }
        });

    } catch (error) {
        console.error("Erreur :", error.message);
        process.exit(1);
    }
}

archiverDonnees();