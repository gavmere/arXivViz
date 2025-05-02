# arXivViz
## A visual of 10,000 arXiv papers

# What is it

This is a visual of the first 10,000 arXiv papers from the Kaggle arXiv dataset ([link](https://www.kaggle.com/datasets/Cornell-University/arxiv)). It is meant to be a sort of self-serve research aide to see what kind of papers are where. But to be honest I thought it would just be pretty cool.

# How it's made and rationale

The process is very data heavy, following 4 main steps:

## Preprocessing (Embedding)

1.  **Data Loading & Preprocessing:** The first 10,000 records are loaded from the `arxiv-metadata-oai-snapshot.json` file from kaggle. Relevant fields (ID, title, abstract, authors, categories, update date) are extracted. Author names are cleaned, and categories are simplified. A combined 'title_abstract' field is created for embedding. 
2.  **Embedding Generation:** OpenAI's `text-embedding-3-large` model (reduced to 256 dimensions) is used to generate vector embeddings for the 'title_abstract' of each paper. This process should capture semantic meanings of each paper's title and abstract. I also used parallelization of API requests and rate limit optimization to OpenAI, but I'm a data scientist what do I know about that ¯\_(ツ)_/¯

## Clustering

To group similar papers, K-Means clustering is applied to the generated embeddings.
*   Embeddings are first L2 normalized (I do not think I needed to do this since it says that the embeddings are already normalized).
*   K-Means is run for a range of cluster numbers (k=3 to k=15).
*   The cluster assignments for each value of 'k' are stored in separate columns (e.g., `kmeans_k3`, `kmeans_k4`, etc.) in the DataFrame. This allows users to select different clustering granularities in the visualization. 

## Dimensionality Reduction

The high-dimensional (256 dimensions) embeddings are reduced to 3 dimensions for visualization using Uniform Manifold Approximation and Projection (UMAP).
*   UMAP is chosen as it's effective at preserving both local and global structure in the data.
*   Parameters used: `n_components=3`, `n_neighbors=15`, `min_dist=0.1`, `metric='cosine'`, another note is that since these vectors are normalized already I could have used cosine or euclidean, but explicit > implicit
*   The resulting 3D coordinates (umap_x, umap_y, umap_z) are added to the DataFrame.

## Visualization

The final data frame is then exported as a JSON, and read by the HTML, CSS, and JS. TBH [The 3D-Force-Graph](https://github.com/vasturiano/3d-force-graph?tab=readme-ov-file) Libray does most of the work, I just read the data I created. I also did some 'prompt engineering' as they would say for help on the webdev stuff, again, I'm a data scientist what do I know about that ¯\_(ツ)_/¯. 

# Conclusion
I hope you have fun with this, it's was pretty fun(strating) to make. Please explore and find some interesting things.
