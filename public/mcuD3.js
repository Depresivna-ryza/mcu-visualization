import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm"; // Import D3

// Global variables
let data; // Data from movie_stats.csv
let listDiv, infoDiv, selectionDiv, networkDiv, phaseSelectorDiv;
let form;

// Load the CSV file and initialize the application
d3.csv("./public/movie_stats.csv").then(function (csvData) {
    // Store loaded data in global variable
    data = csvData;

    // Initialize the views
    init();

    // Visualize the data
    visualization();
});

/*----------------------
INITIALIZE VISUALIZATION
----------------------*/
function init() {
    // Select the divs
    listDiv = d3.select("#list_div");
    infoDiv = d3.select("#info_div");
    selectionDiv = d3.select("#selection_div");
    networkDiv = d3.select("#network_div");

    // Create a form element to hold the checkboxes
    form = listDiv.append("form");

    // Create a div for phase selector
    phaseSelectorDiv = listDiv.append("div")
        .attr("id", "phase_selector")
        .style("margin-top", "20px");

    // Add phase selector buttons
    addPhaseSelector();
}

/*----------------------
BEGINNING OF VISUALIZATION
----------------------*/
function visualization() {
    drawCheckboxes();
    drawNetworkGraph(); // Initial draw without any phase filter
}

/*----------------------
ADD PHASE SELECTOR
----------------------*/
function addPhaseSelector() {
    const phases = [1, 2, 3, 4];

    phaseSelectorDiv.append("span")
        .text("Select Phase: ")
        .style("font-weight", "bold")
        .style("margin-right", "10px");

    phases.forEach(phase => {
        phaseSelectorDiv.append("button")
            .attr("type", "button")
            .text(`Phase ${phase}`)
            .style("margin-right", "5px")
            .style("padding", "5px 10px")
            .on("click", () => {
                // On button click, filter and update the network graph
                updateNetworkGraph(phase);
            });
    });

    // Optionally, add a button to reset the filter
    phaseSelectorDiv.append("button")
        .attr("type", "button")
        .text("All Phases")
        .style("margin-left", "20px")
        .style("padding", "5px 10px")
        .on("click", () => {
            // Reset filter and redraw the network graph
            drawNetworkGraph();
        });
}

/*----------------------
DRAW CHECKBOXES
----------------------*/
function drawCheckboxes() {
    // Add checkboxes to the form
    const rows = form.selectAll("div")
        .data(data)
        .enter()
        .append("div")
        .on("mouseover", function (event, d) {
            displayMovieInfo(d);
        });

    rows.append("label")
        .text(d => d.movie_title)
        .append("input")
        .attr("type", "checkbox")
        .attr("value", d => d.movie_title)
        .attr("name", "movies")
        .on("change", function (event, d) {
            updateSelectedMovies();
        });
}

/*----------------------
DISPLAY MOVIE INFO
----------------------*/
function displayMovieInfo(movie) {
    infoDiv.html(`
        <h2>${movie.movie_title}</h2>
        <p>MCU Phase: ${movie.phase}</p>
        <p>Release Date: ${movie.release_date}</p>
        <p>Tomato Meter: ${movie.tomato_meter}%</p>
        <p>Audience Score: ${movie.audience_score}%</p>
        <p>Movie Duration: ${movie.movie_duration} minutes</p>
        <p>Production Budget: ${movie.production_budget}</p>
        <p>Opening Weekend: ${movie.opening_weekend}</p>
        <p>Domestic Box Office: ${movie.domestic_box_office}</p>
        <p>Worldwide Box Office: ${movie.worldwide_box_office}</p>
    `);
}

/*----------------------
UPDATE SELECTED MOVIES
----------------------*/
function updateSelectedMovies() {
    const selectedMovies = form.selectAll("input:checked").nodes().map(node => node.value);
    selectionDiv.html(selectedMovies.join(", "));
}

/*----------------------
DRAW NETWORK GRAPH
----------------------*/
function drawNetworkGraph(filteredPhase = null) {
    // Remove existing SVG if any
    networkDiv.select("svg").remove();

    // Load nodes and edges in parallel
    Promise.all([
        d3.csv("./public/movies_characters_list.csv"),         // contains name, type
        d3.csv("./public/movies_characters_occurences.csv"),  // contains movie, character
        d3.csv("./public/movie_stats.csv")                     // contains movie_title, phase
    ]).then(([listData, edgesData, statsData]) => {
        let filteredMovies;

        if (filteredPhase) {
            // Filter movies based on the selected phase
            filteredMovies = statsData.filter(d => +d.mcu_phase === filteredPhase).map(d => d.movie_title);
        } else {
            // If no phase filter, include all movies
            filteredMovies = statsData.map(d => d.movie_title);
        }

        // Filter edges to include only those in the filtered movies
        const filteredLinks = edgesData.filter(d => filteredMovies.includes(d.movie));

        // Extract characters from the filtered links
        const filteredCharacters = [...new Set(filteredLinks.map(d => d.character))];

        // Filter nodes to include only filtered movies and characters
        const filteredNodes = listData.filter(d => 
            (d.type === "movie" && filteredMovies.includes(d.name)) ||
            (d.type === "character" && filteredCharacters.includes(d.name))
        );

        // Convert listData to nodes
        const nodes = filteredNodes.map(d => ({
            id: d.name,
            group: d.type
        }));

        // Convert edgesData to links
        const links = filteredLinks.map(d => ({
            source: d.movie,
            target: d.character
        }));

        const width = 800;
        const height = 600;
        const radius = 10; // node radius

        // Build an adjacency list so we know the neighbors for each node
        const adjacency = {};
        nodes.forEach(n => {
            adjacency[n.id] = [];
        });

        links.forEach(l => {
            adjacency[l.source].push(l.target);
            adjacency[l.target].push(l.source);
        });

        const svg = networkDiv.append("svg")
            .attr("width", width)
            .attr("height", height);

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(10)) // Adjusted distance for spacing
            .force("charge", d3.forceManyBody().strength(100)) // Increased charge for more separation
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide()
                .radius(d => d.group === "movie" ? 2.5 * radius : radius + 10)
                .strength(5)
            )
                 // Collision to prevent overlapping
            ;

        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .enter()
            .append("line")
            .attr("stroke-width", 2)
            .attr("stroke", "#999");

        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(nodes)
            .enter()
            .append("circle")
            .attr("r", d => d.group === "movie" ? 2.5 * radius : radius)
            .attr("fill", d => d.group === "movie" ? "blue" : "red");

        node.append("title")
            .text(d => d.id);

        // On mouseover, highlight neighbors and dim others
        node.on("mouseover", function(event, d) {
            // Gather neighbors from adjacency list
            const neighbors = adjacency[d.id] || [];

            // Highlight this node and its neighbors, dim others
            node.attr("opacity", n => {
                return n.id === d.id || neighbors.includes(n.id) ? 1 : 0.2;
            });

            // Highlight links connected to this node or its neighbors
            link.attr("opacity", l => {
                // A link is visible if it connects the hovered node or a neighbor
                return (l.source.id === d.id || l.target.id === d.id ||
                        neighbors.includes(l.source.id) || neighbors.includes(l.target.id))
                       ? 1 : 0.2;
            });
        });

        // On mouseout, reset all to full opacity
        node.on("mouseout", function() {
            node.attr("opacity", 1);
            link.attr("opacity", 1);
        });

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => {
                    // Clamp x within [radius, width - radius]
                    d.x = Math.max(radius, Math.min(width - radius, d.x));
                    return d.x;
                })
                .attr("cy", d => {
                    // Clamp y within [radius, height - radius]
                    d.y = Math.max(radius, Math.min(height - radius, d.y));
                    return d.y;
                });
        });
    }).catch(error => {
        console.error("Error loading CSV files:", error);
    });
}

/*----------------------
UPDATE NETWORK GRAPH BASED ON PHASE
----------------------*/
function updateNetworkGraph(phase) {
    drawNetworkGraph(phase);
}