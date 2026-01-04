import pandas as pd
from datetime import timedelta
import pytz
import os

def process():
    file_path = 'historique.csv'
    if not os.path.exists(file_path):
        print("Fichier historique.csv non trouvé.")
        return

    # Lecture avec séparateur point-virgule
    df = pd.read_csv(file_path, sep=';', decimal='.', encoding='utf-8-sig')
    
    # Temps UTC (source du fichier)
    df['dt_utc'] = pd.to_datetime(df['date'] + ' ' + df['heure'], dayfirst=True)
    
    # Temps LOCAL (pour le reset du compteur pluie Netatmo)
    local_tz = pytz.timezone("Europe/Paris")
    df['dt_local'] = df['dt_utc'].dt.tz_localize('UTC').dt.tz_convert(local_tz)
    df['date_locale'] = df['dt_local'].dt.date

    results = []
    villes = df['ville'].unique()
    
    # On traite les jours présents dans le fichier (en UTC pour TN/TX)
    jours_utc = sorted(df['dt_utc'].dt.date.unique())

    for ville in villes:
        df_v = df[df['ville'] == ville]
        for d in jours_utc:
            # TN : 18h UTC (J-1) à 18h UTC (J)
            t_start_tn = pd.Timestamp(d - timedelta(days=1)).replace(hour=18, minute=0)
            t_end_tn = pd.Timestamp(d).replace(hour=18, minute=0)
            tn = df_v[(df_v['dt_utc'] >= t_start_tn) & (df_v['dt_utc'] <= t_end_tn)]['temperature'].min()

            # TX : 06h UTC (J) à 06h UTC (J+1)
            t_start_tx = pd.Timestamp(d).replace(hour=6, minute=0)
            t_end_tx = pd.Timestamp(d + timedelta(days=1)).replace(hour=6, minute=0)
            tx = df_v[(df_v['dt_utc'] >= t_start_tx) & (df_v['dt_utc'] <= t_end_tx)]['temperature'].max()

            # RR24 : Max du compteur pluie_24h sur la journée civile locale
            # (Puisque le compteur revient à 0 à 00h locale)
            rr24 = df_v[df_v['date_locale'] == d]['pluie_24h'].max()

            if pd.notna(tn) or pd.notna(tx):
                results.append({
                    'date': d.strftime('%d/%m/%Y'),
                    'nom station': ville,
                    'TN': tn,
                    'TX': tx,
                    'RR24': rr24 if pd.notna(rr24) else 0.0
                })

    final_df = pd.DataFrame(results)
    # Tri par date décroissante
    final_df['sort_date'] = pd.to_datetime(final_df['date'], dayfirst=True)
    final_df = final_df.sort_values(['sort_date', 'nom station'], ascending=[False, True]).drop(columns=['sort_date'])
    
    final_df.to_csv('stats_stations.csv', index=False, sep=';')
    print("Fichier stats_stations.csv mis à jour.")

if __name__ == "__main__":
    process()