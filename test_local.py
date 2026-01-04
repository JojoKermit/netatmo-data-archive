import pandas as pd

try:
    # On teste la lecture
    df = pd.read_csv('historique.csv', sep=';', nrows=0, encoding='utf-8-sig')
    print("Colonnes trouvées :", df.columns.tolist())
    
    if 'date' in df.columns:
        print("✅ La colonne 'date' est bien reconnue !")
    else:
        print("❌ La colonne 'date' n'est PAS reconnue.")
        # Affichage des caractères invisibles s'il y en a
        print("Noms réels des colonnes (repr) :", [repr(c) for c in df.columns])

except Exception as e:
    print(f"Erreur lors de la lecture : {e}")