
import pandas as pd

# Carga los CSV
autores_df = pd.read_csv('data/data/IPBLN/csv/authors_IPBLN.csv', dtype=str)
publicaciones_df = pd.read_csv('data/data/IPBLN/csv/items_only_IPBLN.csv', dtype=str, sep='\t')

from itertools import combinations

# Crear lista de enlaces (pares de coautores)
edges = []

for _, fila in publicaciones_df.iterrows():
    if pd.isna(fila['id_autores']):
        continue
    autores_ids = [aid.strip() for aid in fila['id_autores'].split('|') if aid.strip() != '']
    if len(autores_ids) < 2:
        continue
    pares = combinations(sorted(set(autores_ids)), 2)  # sin duplicados y ordenados
    edges.extend(pares)

edges_df = pd.DataFrame(edges, columns=['Source', 'Target'])
edges_df['Weight'] = 1

# Sumar pesos por pares repetidos (colaboraciones múltiples)
edges_summary = edges_df.groupby(['Source', 'Target'], as_index=False).sum()

autores_ipbln_ids = set(autores_df['id_autor_gesbib'].astype(str))
edges_summary = edges_summary[
    edges_summary['Source'].isin(autores_ipbln_ids) &
    edges_summary['Target'].isin(autores_ipbln_ids)
]
edges_summary.to_csv('data/data/IPBLN/networks/coautorias_IPBLN.csv', index=False)

nodos = pd.DataFrame({'Id': list(autores_ipbln_ids)})
nodos = nodos.merge(autores_df[['id_autor_gesbib', 'Nombre']], left_on='Id', right_on='id_autor_gesbib', how='left')
nodos = nodos[['Id', 'Nombre']].rename(columns={'Nombre': 'Label'})
nodos.to_csv('data/data/IPBLN/networks/nodos_IPBLN.csv', index=False)


