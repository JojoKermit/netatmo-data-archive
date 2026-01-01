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
            grant_type: 'password',
            client_id: process.env.NETATMO_CLIENT_ID,
            client_secret: process.env.NETATMO_CLIENT_SECRET,
            username: process.env.NETATMO_USERNAME,
            password: process.env.NETATMO_PASSWORD
        });

        const authRes = await axios.post('https://api.netatmo.com/oauth2/token', authParams);
        const token = authRes.data.access_token;

        // 2. Récupération (Zone large couvrant les deux villes)
        const res = await axios.get('https://api.netatmo.com/api/getpublicdata', {
            params: { lat_ne: 47.26, lon_ne: 5.23, lat_sw: 47.20, lon_sw: 5.17 },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const toutesLesStations = res.data.body;
        const maintenant = new Date();
        const dateLoc = maintenant.toLocaleDateString('fr-FR');
        const heureLoc = maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        STATIONS.forEach(cible => {
            const dataStation = toutesLesStations.find(s => s._id === cible.id);

            if (dataStation) {
                let temp = "N/A", hum = "N/A", pluie_1h = 0, pluie_24h = 0;

                // Temp/Hum
                if (dataStation.measures) {
                    const ts = Object.keys(dataStation.measures)[0];
                    const v = dataStation.measures[ts].res[ts];
                    temp = v[0]; hum = v[1];
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
                console.log(`✅ ${cible.nom} archivé.`);
            }
        });

    } catch (error) {
        console.error("Erreur :", error.message);
        process.exit(1);
    }
}

archiverDonnees();