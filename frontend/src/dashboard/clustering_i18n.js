/**
 * I18n dictionaries for the clustering modal.
 *
 * This module is intentionally side-effect free so it can be imported from
 * the dashboard without altering runtime behavior.
 */

/**
 * Spanish descriptions for clustering models.
 *
 * @type {Record<string, string>}
 */
export const spanishModelDescriptions = {
    kmeans: 'Agrupa los datos en un número fijo de categorías (clusters) tratando de minimizar la distancia entre los puntos de cada grupo y su centroide, es decir, su "centro". Este método busca particiones compactas y bien separadas, y es especialmente útil cuando los grupos tienen forma redonda o esférica. Es rápido y eficiente, aunque sensible a la elección inicial del número de grupos (k) y a los valores extremos.',
    agglomerative: 'Construye agrupaciones de forma jerárquica: comienza considerando cada autor como un grupo separado y va fusionando los más similares en pasos sucesivos. El resultado es una estructura en forma de árbol (dendrograma), que permite explorar diferentes niveles de agrupación según la profundidad del corte. Es útil cuando no se conoce el número exacto de grupos y se desea analizar la relación progresiva entre autores.',
    spectral: 'Transforma la relación entre autores en una red (o grafo) de similitudes y la descompone matemáticamente para encontrar estructuras ocultas. Posteriormente, agrupa los autores en ese nuevo espacio. Es muy útil cuando las agrupaciones no tienen una forma clara o son no convexas, como anillos o cadenas, y aprovecha la conectividad global de los datos.',
    gmm: 'Parte de la idea de que los datos provienen de una combinación de distribuciones estadísticas llamadas Gaussianas (curvas en forma de campana). En lugar de asignar cada punto a un único cluster, estima la probabilidad de que pertenezca a cada uno. Esto le permite detectar clusters superpuestos o de formas más complejas que los que detecta KMeans, siendo ideal cuando se sospecha que los datos tienen estructuras suaves o ambiguas.',
    dbscan: 'Identifica grupos basándose en la densidad de los puntos: busca regiones donde los puntos están muy juntos y los separa de las regiones más dispersas. Es especialmente útil cuando los clusters tienen formas arbitrarias y no se conoce el número de grupos a priori. Puede identificar puntos de ruido (outliers) y no requiere especificar el número de clusters.',
    hdbscan: 'Es una versión jerárquica de DBSCAN que puede encontrar clusters de diferentes densidades. En lugar de usar un único umbral de densidad, construye una jerarquía de clusters y luego selecciona los más significativos. Es robusto a los parámetros y puede encontrar clusters de formas arbitrarias.',
    lovaina: 'Algoritmo de detección de comunidades que optimiza la modularidad de la red. Funciona de manera iterativa, moviendo nodos entre comunidades para maximizar la modularidad. Es especialmente efectivo para detectar comunidades en redes grandes y puede encontrar comunidades de diferentes tamaños.',
};

/**
 * English descriptions for clustering models.
 *
 * @type {Record<string, string>}
 */
export const englishModelDescriptions = {
    kmeans: 'It groups the data into a fixed number of categories (clusters) trying to minimize the distance between the points of each group and its centroid, that is, its "center". This method looks for compact and well-separated partitions, and is especially useful when the clusters are round or spherical in shape. It is fast and efficient, although sensitive to the initial choice of the number of groups (k) and to extreme values.',
    agglomerative: 'It builds groupings in a hierarchical way: it starts by considering each author as a separate group and merges the most similar ones in successive steps. The result is a tree-like structure (dendrogram), which allows exploring different levels of grouping according to the depth of the cut. It is useful when the exact number of groups is not known and it is desired to analyze the progressive relationship between authors.',
    spectral: 'It transforms the relationship between authors into a network (or graph) of similarities and decomposes it mathematically to find hidden structures. It then clusters the authors in this new space. It is very useful when the groupings do not have a clear shape or are non-convex, such as rings or chains, and takes advantage of the global connectivity of the data.',
    gmm: 'It starts from the idea that the data come from a combination of statistical distributions called Gaussian (bell-shaped curves). Instead of assigning each point to a single cluster, it estimates the probability that it belongs to each cluster. This allows it to detect overlapping or more complex-shaped clusters than KMeans detects, making it ideal when data are suspected of having soft or ambiguous structures.',
    dbscan: 'Identifies groups based on the density of points: it looks for regions where points are very close together and separates them from more scattered regions. It is especially useful when clusters have arbitrary shapes and the number of groups is not known a priori. It can identify noise points (outliers) and does not require specifying the number of clusters.',
    hdbscan: 'It is a hierarchical version of DBSCAN that can find clusters of different densities. Instead of using a single density threshold, it builds a hierarchy of clusters and then selects the most significant ones. It is robust to parameters and can find clusters of arbitrary shapes.',
    lovaina: 'A community detection algorithm that optimizes network modularity. It works iteratively, moving nodes between communities to maximize modularity. It is especially effective for detecting communities in large networks and can find communities of different sizes.',
};

/**
 * Spanish UI strings for the clustering modal.
 *
 * @type {Record<string, string>}
 */
export const spanishTexts = {
    clusters: 'clusters',
    bestConfig: 'Mejor Configuración',
    globalBestConfig: 'Mejor Configuración Global',
    manualConfig: 'Configuración Manual',
    numberOfClusters: 'Número de Clusters',
    clusteringModel: 'Modelo de Clustering',
    configurationMode: 'Modo de Configuración',
    apply: 'Aplicar',
    cancel: 'Cancelar',
    globalBestDescription: 'Usa la mejor configuración de clustering encontrada entre todos los modelos y parámetros.',
};

/**
 * English UI strings for the clustering modal.
 *
 * @type {Record<string, string>}
 */
export const englishTexts = {
    clusters: 'clusters',
    bestConfig: 'Best Configuration',
    globalBestConfig: 'Global Best Configuration',
    manualConfig: 'Manual Configuration',
    numberOfClusters: 'Number of Clusters',
    clusteringModel: 'Clustering Model',
    configurationMode: 'Configuration Mode',
    apply: 'Apply',
    cancel: 'Cancel',
    globalBestDescription: 'Uses the best clustering configuration found across all models and parameters.',
};
