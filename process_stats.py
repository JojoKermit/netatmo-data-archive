import pandas as pd
from datetime import timedelta
import pytz
import os

def process():
    file_path = 'historique.csv'
    output_path = 'stats_stations.csv'
    
    if not os.path.exists(file_path):
        print(f"Erreur : {file_path} est introuvable.")
        return

    # 1. Lecture du fichier (Format normalisé : point-virgule et décimales avec point)
    # encoding='utf-8-sig' gère les éventuels caractères invisibles de début de fichier
    df = pd.read_csv(file_path, sep=';', decimal='.', encoding='utf-8-sig')
    
    # Nettoyage des noms de colonnes au cas où des espaces traîneraient
    df.columns = df.columns.str.strip()

    # 2. Conversion des dates
    # On crée une colonne datetime UTC à partir des colonnes date et heure
    df['dt_utc'] = pd.to_datetime(df['date'] + ' ' + df['heure'], dayfirst=True)
    
    # On crée une version en heure locale pour identifier le "minuit" de la station (Reset Pluie)
    local_tz = pytz.timezone("Europe/Paris")
    df['dt_local'] = df['dt_utc'].dt.tz_localize('UTC').dt.tz_convert(local_tz)
    df['date_locale'] = df['dt_local'].dt.date

    results = []
    villes = df['ville'].unique()
    # On traite chaque jour présent dans le fichier (basé sur la date UTC)
    jours_utc = sorted(df['dt_utc'].dt.date.unique())

    for ville in villes:
        df_v = df[df['ville'] == ville]
        
        for d in jours_utc:
            # --- CALCUL DES TEMPÉRATURES (FENÊTRES UTC) ---
            # TN : 18h UTC (J-1) à 18h UTC (J)
            t_start_tn = pd.Timestamp(d - timedelta(days=1)).replace(hour=18, minute=0)
            t_end_tn = pd.Timestamp(d).replace(hour=18, minute=0)
            tn = df_v[(df_v['dt_utc'] >= t_start_tn) & (df_v['dt_utc'] <= t_end_tn)]['temperature'].min()

            # TX : 06h UTC (J) à 06h UTC (J+1)
            t_start_tx = pd.Timestamp(d).replace(hour=6, minute=0)
            t_end_tx = pd.Timestamp(d + timedelta(days=1)).replace(hour=6, minute=0)
            tx = df_v[(df_v['dt_utc'] >= t_start_tx) & (df_v['dt_utc'] <= t_end_tx)]['temperature'].max()

            # --- CALCUL DE LA PLUIE (CALENDRIER CIVIL LOCAL) ---
            # Le compteur pluie_24h de Netatmo se remet à 0 à minuit LOCAL.
            # On prend donc la valeur maximale enregistrée durant la journée locale d.
            rr24 = df_v[df_v['date_locale'] == d]['pluie_24h'].max()

            # On n'ajoute la ligne que si on a au moins une donnée de température
            if pd.notna(tn) or pd.notna(tx):
                results.append({
                    'date': d.strftime('%d/%m/%Y'),
                    'nom station': ville,
                    'TN': round(float(tn), 1) if pd.notna(tn) else None,
                    'TX': round(float(tx), 1) if pd.notna(tx) else None,
                    'RR24': round(float(rr24), 1) if pd.notna(rr24) else 0.0
                })

    if not results:
        print("Aucune donnée statistique n'a pu être générée.")
        return

    # 3. Création du fichier final
    final_df = pd.DataFrame(results)
    
    # Tri par date décroissante pour voir les données récentes en haut
    final_df['sort_date'] = pd.to_datetime(final_df['date'], dayfirst=True)
    final_df = final_df.sort_values(['sort_date', 'nom station'], ascending=[False, True]).drop(columns=['sort_date'])
    
    # Sauvegarde au format CSV (séparateur ; pour compatibilité Excel FR)
    final_df.to_csv(output_path, index=False, sep=',', encoding='utf-8')
    print(f"Succès ! Le fichier {output_path} a été mis à jour.")

if __name__ == "__main__":
    process()
