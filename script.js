// --- Configuration ---
const pointsDataPath = '../data/data.json';
const coordXField = 'umap_x';
const coordYField = 'umap_y';
const coordZField = 'umap_z';
const clusterColors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
    '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
];
const defaultColor = '#555555';

// --- HTML Elements ---
const graphContainer = document.getElementById('graph-container');
const legendContainer = document.getElementById('legend'); // Get legend container
const legendItemsContainer = document.getElementById('legend-items');
const clusterSelector = document.getElementById('cluster-selector');
const loadingIndicator = document.getElementById('loading');

// --- Global Variables ---
let Graph;
let allPointsData = [];
let originalDataMap = new Map();
let currentClusterKey = '';

// --- Helper Functions ---

function getClusterColor(clusterId) {
    if (typeof clusterId !== 'number' || isNaN(clusterId) || clusterId < 0) {
         // console.warn("Invalid clusterId encountered:", clusterId); // Less console noise
        return defaultColor;
    }
    return clusterColors[clusterId % clusterColors.length] || defaultColor;
}

function getNodeColor(node) {
    const point = originalDataMap.get(node.id);
    if (point && currentClusterKey && point.hasOwnProperty(currentClusterKey)) {
        const clusterId = point[currentClusterKey];
        return getClusterColor(clusterId);
    }
    return defaultColor;
}

function getNodeLabel(node) {
     const point = originalDataMap.get(node.id);
     if (!point) return '';

     let clusterInfo = 'Cluster: N/A';
     let clusterId = 'N/A';
     if (currentClusterKey && point.hasOwnProperty(currentClusterKey)) {
         clusterId = point[currentClusterKey];
         const kValue = currentClusterKey.replace('kmeans_k', '');
         clusterInfo = `Cluster (K=${kValue}): ${clusterId}`;
     }

     const title = point.title ? point.title.replace(/\n\s*/g, ' ').trim() : 'No Title';
     const authors = point.authors ? point.authors.join(', ') : 'N/A';
     const categories = point.categories || 'N/A';
     const coordsOriginal = (point.hasOwnProperty(coordXField) && point.hasOwnProperty(coordYField) && point.hasOwnProperty(coordZField))
         ? `(${point[coordXField].toFixed(3)}, ${point[coordYField].toFixed(3)}, ${point[coordZField].toFixed(3)})`
         : '(Coords unavailable)';

     return `
        <div class="graph-tooltip">
            <div><b>ID:</b> ${node.id}</div>
            <div><b>Title:</b> ${title}</div>
            <div><b>Authors:</b> ${authors}</div>
            <div><b>Categories:</b> ${categories}</div>
        </div>
     `;
}

function updateLegend(clusterKey) {
    // Find the h3 element *safely*
    const legendTitleElement = legendContainer ? legendContainer.querySelector('h3') : null; // Query within the container

    legendItemsContainer.innerHTML = ''; // Clear previous legend items

    // Default title if element not found or no key
    const defaultTitle = 'Cluster Legend';
    if (legendTitleElement) {
         legendTitleElement.textContent = defaultTitle;
    }

    if (!allPointsData.length) {
        legendItemsContainer.innerHTML = '<span>No data loaded.</span>';
        return;
    }
    if (!clusterKey) {
        legendItemsContainer.innerHTML = '<span>Select a clustering method.</span>';
        return;
    }

    // Update legend title if element exists
    if (legendTitleElement) {
         const kValue = clusterKey.replace('kmeans_k', '');
         legendTitleElement.textContent = `Legend (K=${kValue})`;
    } else {
        console.warn("Could not find legend title element (h3 in #legend).");
    }


    const clusterIdsInData = allPointsData
        .map(p => p[clusterKey])
        .filter(id => typeof id === 'number' && !isNaN(id));

    if (clusterIdsInData.length === 0) {
         legendItemsContainer.innerHTML = `<span>No numeric cluster data found for '${clusterKey}'.</span>`;
         return;
    }

    const uniqueClusters = [...new Set(clusterIdsInData)].sort((a, b) => a - b);

    if(uniqueClusters.length > clusterColors.length) {
        console.warn(`Warning: More unique clusters (${uniqueClusters.length}) than defined colors (${clusterColors.length}) for ${clusterKey}. Colors will repeat.`);
    }

    uniqueClusters.forEach(clusterId => {
        const color = getClusterColor(clusterId);
        const legendItem = document.createElement('div');
        legendItem.classList.add('legend-item');
        legendItem.innerHTML = `
            <div class="legend-color" style="background-color: ${color};"></div>
            <span>Cluster ${clusterId}</span>
        `;
        legendItemsContainer.appendChild(legendItem);
    });
}

function updateGraphVisualization() {
    if (!Graph || !allPointsData.length) return;

    const selectedKey = clusterSelector.value;
    if (!selectedKey) return;

    console.log(`Updating visualization for clustering: ${selectedKey}`);
    currentClusterKey = selectedKey;

    // Update node colors
    Graph.nodeColor(Graph.nodeColor());

    // Update the legend
    updateLegend(currentClusterKey);
}


// --- Main Logic ---

async function initializeGraph() {
    loadingIndicator.style.display = 'block';
    graphContainer.style.opacity = 0.5;
    clusterSelector.disabled = true;

    // Clear previous error messages
    const existingError = graphContainer.querySelector('.error-message');
    if (existingError) {
        graphContainer.removeChild(existingError);
    }


    try {
        // Fetch points data
        const pointsResponse = await fetch(pointsDataPath);
        if (!pointsResponse.ok) {
            throw new Error(`HTTP error! Status: ${pointsResponse.status} loading ${pointsDataPath}`);
        }
        // Try parsing JSON safely
        let rawData;
        try {
            rawData = await pointsResponse.json();
        } catch (jsonError) {
            console.error("JSON Parsing Error:", jsonError);
            throw new Error(`Failed to parse JSON data from ${pointsDataPath}. Check if the file is valid JSON.`);
        }

        allPointsData = rawData; // Assign after successful parsing


        if (!allPointsData || !Array.isArray(allPointsData) || allPointsData.length === 0) {
            throw new Error("Data loaded is empty, not an array, or invalid.");
        }

        // Store original data in map
        originalDataMap.clear();
        allPointsData.forEach(p => {
            if (p && p.id != null) { // Basic check for valid point structure
                originalDataMap.set(p.id, p);
            } else {
                console.warn("Skipping data point without id:", p);
            }
        });
        if (originalDataMap.size === 0 && allPointsData.length > 0) {
            throw new Error("No data points with valid 'id' field found.");
        }


        // --- Check for coordinates ---
        const firstPoint = allPointsData[0]; // Check first point as sample
         if (!firstPoint || typeof firstPoint[coordXField] !== 'number' || typeof firstPoint[coordYField] !== 'number' || typeof firstPoint[coordZField] !== 'number') {
             // Check a few more points just in case the first is weird
             const samplePoints = allPointsData.slice(0, 5);
             const coordsExist = samplePoints.some(item =>
                 item && typeof item[coordXField] === 'number' &&
                 typeof item[coordYField] === 'number' &&
                 typeof item[coordZField] === 'number'
             );
             if(!coordsExist) {
                 throw new Error(`Required coordinate fields ('${coordXField}', '${coordYField}', '${coordZField}') not found or not numbers in sample data points.`);
             } else {
                 console.warn("Some initial data points might be missing coordinate fields.");
             }
         }


        // --- Identify Cluster Keys and Populate Selector ---
        clusterSelector.innerHTML = ''; // Clear loading message
        const firstItemKeys = Object.keys(firstPoint || {}); // Use first valid point
        const clusterKeys = firstItemKeys
            .filter(key => /^kmeans_k\d+$/.test(key))
            .sort((a, b) => {
                const numA = parseInt(a.split('kmeans_k')[1], 10);
                const numB = parseInt(b.split('kmeans_k')[1], 10);
                return numA - numB;
            });

        if (clusterKeys.length === 0) {
             throw new Error("No 'kmeans_kX' fields (e.g., 'kmeans_k3') found in the first data item. Cannot create selector.");
        }

        clusterKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            const kValue = key.replace('kmeans_k', '');
            option.textContent = `KMeans (K=${kValue})`;
            clusterSelector.appendChild(option);
        });

        currentClusterKey = clusterKeys[0];
        clusterSelector.value = currentClusterKey;
        clusterSelector.disabled = false;

        // --- Prepare Graph Data (Nodes) ---
        let maxAbsCoord = 0;
        const nodes = [];
         // ** Calculate sums for centroid *while* creating nodes **
        let sumX = 0, sumY = 0, sumZ = 0;

        allPointsData.forEach(item => {
             // Only add nodes with valid coordinates and ID
            if (item && item.id != null && typeof item[coordXField] === 'number' && typeof item[coordYField] === 'number' && typeof item[coordZField] === 'number') {
                 maxAbsCoord = Math.max(maxAbsCoord, Math.abs(item[coordXField]), Math.abs(item[coordYField]), Math.abs(item[coordZField]));

                 const nodeData = {
                    id: item.id,
                    fx: item[coordXField], // Store original coords first
                    fy: item[coordYField],
                    fz: item[coordZField]
                 };
                 nodes.push(nodeData);

             } else {
                 console.warn(`Skipping node creation for item ID ${item?.id} due to missing ID or coordinates.`);
             }
        });

        if (nodes.length === 0) {
            throw new Error("No valid nodes could be created from the data (check IDs and coordinates).");
        }

        // Determine scale factor
        // Use a fixed factor or calculate based on spread
        const scaleFactor = 120; // Your hardcoded value
        // Estimate desired spread based on max coordinate and scale factor
        // This helps determine camera distance later
        const estimatedSpread = maxAbsCoord * scaleFactor * 1.5; // Multiplier adjusts visible area size estimate

        console.log(`Max abs coordinate: ${maxAbsCoord.toFixed(3)}, Scale factor: ${scaleFactor.toFixed(2)}`);

        // Apply scaling and calculate centroid sums *after* scaling
        sumX = 0; sumY = 0; sumZ = 0; // Reset sums
        nodes.forEach(node => {
            node.fx *= scaleFactor;
            node.fy *= scaleFactor;
            node.fz *= scaleFactor;
            // Add scaled coordinates to sums
            sumX += node.fx;
            sumY += node.fy;
            sumZ += node.fz;
        });

        // Calculate centroid coordinates
        const centroid = {
            x: sumX / nodes.length,
            y: sumY / nodes.length,
            z: sumZ / nodes.length
        };
        console.log("Calculated Centroid (scaled):", centroid);


        const links = [];

        // --- Initialize and Configure Graph ---
        // Clear only the graph rendering area, keep loading/legend structure
        const graphElement = document.getElementById('graph'); // Assuming you might add an ID for the graph itself later
        if (graphElement) {
            graphContainer.removeChild(graphElement);
        }
        // Ensure loading and legend are still direct children if they were removed
        if (!graphContainer.contains(loadingIndicator)) graphContainer.appendChild(loadingIndicator);
        if (!graphContainer.contains(legendContainer)) graphContainer.appendChild(legendContainer);


        Graph = ForceGraph3D({ controlType: 'orbit' })
            (graphContainer) // Render directly into the container
            .graphData({ nodes, links })
            .backgroundColor('rgba(0,0,0,0)')
            .nodeVal(1.5)
            .nodeResolution(8)
            .linkVisibility(false)
            .nodeColor(getNodeColor)
            .nodeLabel(getNodeLabel)
            .onNodeHover(node => graphContainer.style.cursor = node ? 'pointer' : null)
            // Add the onNodeClick handler here
            .onNodeClick(node => {
                if (node && node.id) {
                    const url = `https://arxiv.org/abs/${node.id}`;
                    window.open(url, '_blank'); // Open in a new tab
                }
            })
            .enableNodeDrag(false);

        // --- Set Camera Position to look at Centroid ---
        // Use the estimated spread to set a reasonable initial zoom level
        const cameraDistance = Math.max(estimatedSpread * 1.9, 150); // Ensure minimum distance
        console.log(`Setting camera distance: ${cameraDistance.toFixed(2)}`)

        Graph.cameraPosition(
            { z: cameraDistance }, // Set camera distance along Z axis relative to lookAt point
            centroid, // Look at the calculated centroid {x, y, z}
            1000 // Transition duration in ms (smooth animation)
        );


        // --- Add Event Listener for Selector ---
        clusterSelector.addEventListener('change', updateGraphVisualization);

        // --- Initial Legend Update ---
        updateLegend(currentClusterKey); // Update legend for the default selection

        console.log(`Graph initialized with ${nodes.length} nodes. Defaulting to ${currentClusterKey}. Camera looking at centroid.`);

    } catch (error) {
        // --- Robust Error Handling ---
        console.error("Initialization failed:", error); // Log the actual error

        // Clear container *except* for the error message div if it exists
        const existingErrorMsg = graphContainer.querySelector('.error-message');
        graphContainer.innerHTML = ''; // Clear everything
        if (existingErrorMsg) {
             graphContainer.appendChild(existingErrorMsg); // Put error back if it was there
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message'; // Apply styling
        errorDiv.innerHTML = `<strong>Error initializing visualization:</strong><br>${error.message}<br><br>Please check the browser console (F12) for more details and verify the data file path and format.`;
        // Prepend the error message so it appears at the top
        graphContainer.insertBefore(errorDiv, graphContainer.firstChild);


        clusterSelector.innerHTML = '<option value="">Error</option>';
        clusterSelector.disabled = true;
        // Attempt to update legend/title even in error state
        legendItemsContainer.innerHTML = '<span>Error loading data.</span>';
         const legendTitle = legendContainer ? legendContainer.querySelector('h3') : null;
         if (legendTitle) legendTitle.textContent = "Error";
         // Ensure legend container is still visible if needed
         if (legendContainer && !graphContainer.contains(legendContainer)) {
             graphContainer.appendChild(legendContainer);
         }


    } finally {
         loadingIndicator.style.display = 'none';
         graphContainer.style.opacity = 1;
    }
}

// --- Run ---
// Ensure the DOM is fully loaded before running the script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGraph);
} else {
    initializeGraph(); // DOMContentLoaded has already fired
}