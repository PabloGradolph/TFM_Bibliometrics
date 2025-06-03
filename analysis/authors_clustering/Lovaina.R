library(igraph)
library(RColorBrewer)

# Cargar nodos y aristas
nodes <- read.csv("C:/Users/Pablo/OneDrive/Documentos/Estudios/DATCOM/Trabajo Fin de Máster/App/analysis/data/networks/lab_nodes.csv", stringsAsFactors = FALSE)
edges <- read.csv("C:/Users/Pablo/OneDrive/Documentos/Estudios/DATCOM/Trabajo Fin de Máster/App/analysis/data/networks/lab_edges.csv", stringsAsFactors = FALSE)

# === 2. Crear grafo ===
g <- graph_from_data_frame(d = edges, vertices = nodes, directed = FALSE)

# === 3. Detectar comunidades con algoritmo de Louvain ===
cl <- cluster_louvain(g)
V(g)$community <- membership(cl)

# === 4. Elegir paleta de colores para comunidades ===
num_communities <- length(unique(V(g)$community))
colors <- brewer.pal(min(num_communities, 8), "Set2")
V(g)$color <- colors[V(g)$community]

# === 5. Calcular layout tipo “fuerza” (parecido al de Gephi) ===
layout <- layout_with_fr(g)

# === 6. Dibujar la red ===
plot(
  g,
  layout = layout,
  vertex.label = V(g)$Label,
  vertex.label.color = "black",
  vertex.label.cex = 0.8,
  vertex.size = 18,
  vertex.frame.color = "white",
  edge.color = "lightblue",
  edge.width = 1 + log(E(g)$Weight + 1),
  main = "Red de Coautorías entre IPs del IPBLN"
)

