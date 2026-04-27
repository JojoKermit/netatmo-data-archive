require('dotenv').config();
const axios = require('axios');

async function diagnostiquer() {
    console.log("🚀 Lancement du diagnostic ciblé...");

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
        console.log("✅ Authentification réussie.\n");

        // 2. Récupération des données (Zoom précis sur la zone Bourgogne)
        const res = await axios.get('https://api.netatmo.com/api/getpublicdata', {
            params: {
                lat_ne: 47.40, lon_ne: 5.30,
                lat_sw: 47.10, lon_sw: 5.00
            },
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const stations = res.data.body || [];
        console.log(`📡 Total stations détectées dans la zone : ${stations.length}`);

        // 3. Filtrage sur nos IDs spécifiques
        const mesCibles = {
            "70:ee:50:a9:7c:b0": "VARANGES",
            "70:ee:50:71:3d:00": "GENLIS 1 (Principale)",
            "70:ee:50:2b:56:da": "GENLIS 2 (Secours A)",
            "70:ee:50:18:2d:4c": "GENLIS 3 (Secours B)"
        };

        console.log("\n🔍 Analyse de nos stations :");
        console.log("--------------------------------------------------");

        Object.keys(mesCibles).forEach(id => {
            const s = stations.find(stat => stat._id === id);
            const nom = mesCibles[id];

            if (s) {
                const types = s.measures ? Object.values(s.measures).map(m => m.type).flat() : [];
                console.log(`📍 ${nom} (${id})`);
                if (types.length > 0) {
                    console.log(`   ✅ EN LIGNE | Données : ${types.join(', ')}`);
                } else {
                    console.log(`   ⚠️ EN LIGNE | Mais aucune mesure (vide)`);
                }
            } else {
                console.log(`❌ ${nom} (${id})`);
                console.log(`   Détail : Absente du flux public Netatmo`);
            }
            console.log("--------------------------------------------------");
        });

    } catch (error) {
        console.error("❌ Erreur :");
        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

diagnostiquer();