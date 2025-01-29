import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Global variables
let data;
let networkDiv, infoDiv, phaseSelectorDiv, graphConfigDiv, graphDiv;

let movieSelection = [];
let selectedPhases = new Set();
let showSelected = false;
let selectedGraph = "scatterplot";

let hoveredMovie = null;


let nodes = [];
let links = [];
let adjacency = {};


/*----------------------
LOAD DATA AND INITIALIZE
----------------------*/
d3.csv("./public/movie_stats.csv").then(function (csvData) {
    data = csvData;
    init();
}).catch(error => {
    console.error("Error loading movie_stats.csv:", error);
});

/*----------------------
INITIALIZE VIEW
----------------------*/
function init() {
    // Select the divs
    networkDiv = d3.select("#network_div");
    infoDiv = d3.select("#info_div");
    graphConfigDiv = d3.select("#graph_config_div");
    graphDiv = d3.select("#graph_div");

    // Create a div for phase selector within networkDiv
    phaseSelectorDiv = networkDiv.append("div")
        .attr("id", "phase_selector")
        .style("margin-bottom", "20px");

    // Add phase selector buttons
    addPhaseSelector();

    // Initialize Graph Configuration
    initGraphConfig();

    renderMovieList();
    renderNetworkGraph();
    renderPlot();
}

/*----------------------
INITIALIZE GRAPH CONFIGURATION
----------------------*/
function initGraphConfig() {
    // Add graph type selector
    graphConfigDiv.append("span")
        .text("Select Graph Type: ")
        .style("font-weight", "bold")
        .style("margin-right", "10px");

    // Create radio buttons for Scatterplot and Boxplot
    const graphTypes = ["Scatterplot", "Boxplot"];

    graphConfigDiv.selectAll("label")
        .data(graphTypes)
        .enter()
        .append("label")
        .style("margin-right", "15px")
        .text(d => d)
        .append("input")
        .attr("type", "radio")
        .attr("name", "graphType")
        .attr("value", d => d.toLowerCase())
        .on("change", function() {
            selectedGraph = this.value;
            renderPlot();
        });
}

/*----------------------
RENDER MOVIE LIST
----------------------*/
function renderMovieList() {
    const movieListDiv = d3.select("#movie_list_div");
    movieListDiv.selectAll("*").remove(); // Clear existing content

    const phases = [1, 2, 3, 4];

    phases.forEach(phase => {
        // Phase Header
        const phaseHeader = movieListDiv.append("h3")
            .text(`Phase ${phase}`)
            .style("cursor", "pointer");

        // Select All label
        phaseHeader.append("span")
            .text(" (select all)")
            .style("cursor", "pointer")
            .style("margin-left", "10px")
            .on("click", () => togglePhaseSelection(phase));

        // Movie List
        const movieList = movieListDiv.append("ul")
            .attr("id", `phase_${phase}_list`);

        const moviesInPhase = getMoviesByPhase(phase);
        moviesInPhase.forEach(movie => {
            movieList.append("li")
                .text(movie)
                .style("cursor", "pointer")
                .on("click", () => toggleMovieSelection(movie))
                .style("color", movieSelection.includes(movie) ? "green" : "blue");
        });
    });
}

function toggleMovieSelection(movie) {
    const index = movieSelection.indexOf(movie);
    if (index > -1) {
        // Deselect the movie
        movieSelection.splice(index, 1);
    } else {
        // Select the movie
        movieSelection.push(movie);
    }
    updateNodeColors();
    renderMovieList();
    renderPlot();
    if (showSelected) {
        renderNetworkGraph();
    }
}

function togglePhaseSelection(phase) {
    const moviesInPhase = data.filter(d => +d.phase === phase).map(d => d.movie_title);
    const allSelected = moviesInPhase.every(movie => movieSelection.includes(movie));

    if (allSelected) {
        // Deselect all movies in the phase
        movieSelection = movieSelection.filter(movie => !moviesInPhase.includes(movie));
    } else {
        // Select all movies in the phase
        movieSelection = Array.from(new Set([...movieSelection, ...moviesInPhase]));
    }
    updateNodeColors();
    renderMovieList();
    renderPlot();
    if (showSelected) {
        renderNetworkGraph();
    }
}

function updateNodeColors() {
    networkDiv.selectAll("circle")
        .attr("fill", d => getNodeColor(d));
}

function updateHoveredMovie() {
    let node = networkDiv.selectAll("circle");
    let link = networkDiv.selectAll("line");

    if (hoveredMovie) {
        let neighbors = adjacency[hoveredMovie] || [];
        node.attr("opacity", n => (n.id === hoveredMovie || neighbors.includes(n.id) ? 1 : 0.2));
        link.attr("opacity", l => (l.source.id === hoveredMovie || l.target.id === hoveredMovie ? 1 : 0.2));

        const movieData = data.find(movie => movie.movie_title === hoveredMovie);
        if (movieData) {
            displayMovieInfo(movieData);
        }
        

    graphDiv.selectAll("circle")
        .attr("r", d => d.movie_title === hoveredMovie ? 15 : 5)
        .style("fill", d => d.movie_title === hoveredMovie ? "orange" : "#69b3a2");

    graphDiv.selectAll("rect")
        .style("fill", d => d.movie_title === hoveredMovie ? "orange" : "#69b3a2");

    
    } else {
        node.attr("opacity", 1);
        link.attr("opacity", 1);
        infoDiv.html(`<h2>Hover over a movie node to see details here.</h2>`);

        graphDiv.selectAll("circle")
            .attr("r", 5)
            .style("fill", "#69b3a2");

        graphDiv.selectAll("rect")
            .style("fill", "#69b3a2");

    }
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
            .attr("id", `phase_button_${phase}`)
            .text(`Phase ${phase}`)
            .style("margin-right", "5px")
            .style("padding", "5px 10px")
            .style("background-color", selectedPhases.has(phase) ? "lightblue" : "white")
            .on("click", () => {
                if (selectedPhases.has(phase)) {
                    if (selectedPhases.size > 1) {
                        selectedPhases.delete(phase);
                        updatePhaseButtonStyles();
                        renderNetworkGraph();
                    }
                } else {
                    selectedPhases.add(phase);
                    updatePhaseButtonStyles();
                    renderNetworkGraph();
                }
                showSelected = false;

            });
    });

    phaseSelectorDiv.append("button")
        .attr("type", "button")
        .attr("id", "show_selected_button")
        .text("Show Selected")
        .style("margin-right", "5px")
        .style("padding", "5px 10px")
        .style("background-color", showSelected ? "lightblue" : "white")
        .on("click", () => {
            selectedPhases.clear();
            showSelected = true;
            updatePhaseButtonStyles();
            renderNetworkGraph();
        });
}

function updatePhaseButtonStyles() {
    const phases = [1, 2, 3, 4];
    phases.forEach(phase => {
        d3.select(`#phase_button_${phase}`)
            .style("background-color", selectedPhases.has(phase) ? "lightblue" : "white");
    });
    d3.select("#show_selected_button")
        .style("background-color", showSelected ? "lightblue" : "white");
}

/*----------------------
DRAW NETWORK GRAPH
----------------------*/
function renderNetworkGraph() {
    // Remove existing SVG if any
    networkDiv.select("svg").remove();

    // Load nodes and edges in parallel
    Promise.all([
        d3.csv("./public/movies_characters_list.csv"),        // contains name, type
        d3.csv("./public/movies_characters_occurences.csv"),  // contains movie, character
        d3.csv("./public/movie_stats.csv")                    // contains movie_title, phase
    ]).then(([listData, edgesData, statsData]) => {

        let filteredMovies;
        let nodes;
        let links;

        if (showSelected) {
            filteredMovies = movieSelection;
        } else {
            filteredMovies = data.filter(d => selectedPhases.has(+d.phase)).map(d => d.movie_title);
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
        nodes = filteredNodes.map(d => ({
            id: d.name,
            group: d.type
        }));

        // Convert edgesData to links
        links = filteredLinks.map(d => ({
            source: d.movie,
            target: d.character
        }));

        const width = 800;
        const height = 600;
        const radius = 10; // node radius

        // Build an adjacency list to identify neighbors
        adjacency = {};
        nodes.forEach(n => {
            adjacency[n.id] = [];
        });

        links.forEach(l => {
            adjacency[l.source].push(l.target);
        });

        const svg = networkDiv.append("svg")
            .attr("width", width)
            .attr("height", height);

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(50)) 
            .force("charge", d3.forceManyBody()
                .distanceMax(d => d.group === "movie" ? 2 * radius : 2000 * radius)
                .strength(d => d.group === "movie" ? 500 : -20))
            .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1))
            .force("collide", d3.forceCollide()
                .radius(d => d.group === "movie" ? 3 * radius : 1.5 * radius)
                .strength(1));

        simulation.on("tick", () => {
            link.attr("x1", d => clamp(d.source.x, radius, width - radius))
                .attr("y1", d => clamp(d.source.y, radius, height - radius))
                .attr("x2", d => clamp(d.target.x, radius, width - radius))
                .attr("y2", d => clamp(d.target.y, radius, height - radius));

            node.attr("cx", d => clamp(d.x, radius, width - radius))
                .attr("cy", d => clamp(d.y, radius, height - radius));
        });

        // Draw links with final positions
        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .enter()
            .append("line")
            .attr("stroke-width", 2)
            .attr("stroke", "#999")
            .attr("x1", d => clamp(d.source.x, radius, width - radius))
            .attr("y1", d => clamp(d.source.y, radius, height - radius))
            .attr("x2", d => clamp(d.target.x, radius, width - radius))
            .attr("y2", d => clamp(d.target.y, radius, height - radius));

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // Draw nodes with final positions
        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(nodes)
            .enter()
            .append("circle")
            .attr("r", d => d.group === "movie" ? 2.5 * radius : radius)
            .attr("fill", d => getNodeColor(d))
            .attr("cx", d => clamp(d.x, radius, width - radius))
            .attr("cy", d => clamp(d.y, radius, height - radius))
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Add titles for tooltips
        node.append("title")
            .text(d => d.id);

        // Add interactivity: Highlight adjacent nodes on hover and update infoDiv
        node.on("mouseover", function(event, d) {
            hoveredMovie = d.id;
            updateHoveredMovie();
        });

        node.on("mouseout", function() {
            hoveredMovie = null;
            updateHoveredMovie();
        });

        node.on("click", function(event, d) {
            toggleMovieSelection(d.id);
        });
    });
}

/*----------------------
DRAW SCATTERPLOT
----------------------*/
function renderScatterPlot() {
    let filteredData = data.filter(d => movieSelection.includes(d.movie_title));

    const margin = {top: 20, right: 30, bottom: 50, left: 60},
          width = 600 - margin.left - margin.right,
          height = 400 - margin.top - margin.bottom;

    const svg = graphDiv.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => +d.audience_score) + 10])
        .range([0, width]);
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));
    svg.append("text")             
        .attr("transform", `translate(${width/2},${height + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .text("Audience Score (%)");

    const y = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => +d.tomato_meter) + 10])
        .range([height, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 15)
        .attr("x",0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Critics Score (%)");      

    svg.append('g')
        .selectAll("dot")
        .data(filteredData)
        .enter()
        .append("circle")
            .attr("cx", d => x(+d.audience_score))
            .attr("cy", d => y(+d.tomato_meter))
            .attr("r", 5)
            .style("fill", "#69b3a2")
            .on("mouseover", function(event, d) {
                hoveredMovie = d.movie_title;
                updateHoveredMovie();
                // d3.select(this)
                //     .transition()
                //     .duration(100)
                //     .attr("r", 8)
                //     .style("fill", "orange");
            })
            .on("mouseout", function() {
                hoveredMovie = null;
                updateHoveredMovie();
                // d3.select(this)
                //     .transition()
                //     .duration(100)
                //     .attr("r", 5)
                //     .style("fill", "#69b3a2");
            });

    svg.append("text")
        .attr("x", width / 2 )             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "16px") 
        .style("text-decoration", "underline")  
        .text("Audience Score vs Critics Score Scatterplot");
}

/*----------------------
DRAW BOXPLOT
----------------------*/
function renderBoxPlot() {
    let filteredData = data.filter(d => movieSelection.includes(d.movie_title));

    filteredData.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

    const margin = {top: 20, right: 30, bottom: 100, left: 60},
          width = 600 - margin.left - margin.right,
          height = 400 - margin.top - margin.bottom;

    const svg = graphDiv.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .range([0, width])
        .domain(filteredData.map(d => d.movie_title))
        .padding(0.2);
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")	
            .style("text-anchor", "end")
            .attr("dx", "-0.8em")
            .attr("dy", "-0.15em")
            .attr("transform", "rotate(-65)");

    const y = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => +d.worldwide_box_office) * 1.1])
        .range([height, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 15)
        .attr("x",0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .text("Worldwide Box Office ($)");

    const tooltip = d3.select("body").append("div")	
        .attr("class", "tooltip")				
        .style("position", "absolute")
        .style("background", "#f4f4f4")
        .style("padding", "5px")
        .style("border", "1px solid #d4d4d4")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("opacity", 0);

    svg.selectAll("mybar")
        .data(filteredData)
        .enter()
        .append("rect")
            .attr("x", d => x(d.movie_title))
            .attr("y", d => y(+d.worldwide_box_office))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(+d.worldwide_box_office))
            .attr("fill", "#69b3a2")
            .on("mouseover", function(event, d) {
                hoveredMovie = d.movie_title;
                updateHoveredMovie();
                // d3.select(this)
                //     .attr("fill", "orange");
                // tooltip.transition()		
                //     .duration(200)		
                //     .style("opacity", .9);		
                // tooltip.html(`<strong>${d.movie_title}</strong><br/>Worldwide Box Office: $${Number(d.worldwide_box_office).toLocaleString()}`)	
                //     .style("left", (event.pageX) + "px")		
                //     .style("top", (event.pageY - 28) + "px");	
            })
            .on("mouseout", function() {
                hoveredMovie = null;
                updateHoveredMovie();
                // d3.select(this)
                //     .attr("fill", "#69b3a2");
                // tooltip.transition()		
                //     .duration(500)		
                //     .style("opacity", 0);	
            });

    svg.append("text")
        .attr("x", width / 2 )             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "16px") 
        .style("text-decoration", "underline")  
        .text("Worldwide Box Office by Release Order Boxplot");
}

/*----------------------
UPDATE GRAPHS BASED ON PHASE
----------------------*/
function renderPlot() {
    graphDiv.selectAll("*").remove();

    if (selectedGraph === "scatterplot") {
        renderScatterPlot();
    } else if (selectedGraph === "boxplot") {
        renderBoxPlot();
    }
}

/*----------------------
DISPLAY MOVIE INFO
----------------------*/
function displayMovieInfo(movie) {
    infoDiv.html(`
        <h2>${movie.movie_title}</h2>
        <p><strong>MCU Phase:</strong> ${movie.phase}</p>
        <p><strong>Release Date:</strong> ${movie.release_date}</p>
        <p><strong>Tomato Meter:</strong> ${movie.tomato_meter}%</p>
        <p><strong>Audience Score:</strong> ${movie.audience_score}%</p>
        <p><strong>Movie Duration:</strong> ${movie.movie_duration} minutes</p>
        <p><strong>Production Budget:</strong> $${Number(movie.production_budget).toLocaleString()}</p>
        <p><strong>Opening Weekend:</strong> $${Number(movie.opening_weekend).toLocaleString()}</p>
        <p><strong>Domestic Box Office:</strong> $${Number(movie.domestic_box_office).toLocaleString()}</p>
        <p><strong>Worldwide Box Office:</strong> $${Number(movie.worldwide_box_office).toLocaleString()}</p>
    `);
}

/*----------------------
HELPER FUNCTIONS
----------------------*/
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getMoviesByPhase(phase) {
    return data.filter(d => +d.phase === phase).map(d => d.movie_title);
}

function getNodeColor(d) {
    if (d.group === "movie") {
        return movieSelection.includes(d.id) ? "green" : "blue";
    } else {
        return "red";
    }
}

