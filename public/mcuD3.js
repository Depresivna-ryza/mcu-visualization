import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Global variables
let data;
let networkDiv, infoDiv, graphConfigDiv, graphDiv, scatterPlotDiv, boxPlotDiv, movieListDiv;

let movieSelection = [];
let hoveredMovie = null;

let nodes = [];
let links = [];
let adjacency = {};

// Configuration variables
let scatterplotXVar = "audience_score";
let scatterplotYVar = "tomato_meter";
let boxplotVar = "worldwide_box_office";
let boxplotSorted = "chronological";

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
    scatterPlotDiv = graphDiv.append("div").attr("id", "scatter_plot_div").style("width", "50%").style("vertical-align", "top").style("display", "inline-block");
    boxPlotDiv = graphDiv.append("div").attr("id", "box_plot_div").style("width", "50%").style("vertical-align", "top").style("display", "inline-block");

    // Initialize Graph Configuration
    initGraphConfig();

    renderMovieList();
    renderNetworkGraph();
    renderPlots();
}

/*----------------------
INITIALIZE GRAPH CONFIGURATION
----------------------*/
function initGraphConfig() {
    // Add dropdowns for scatterplot variables
    const scatterplotVars = ["tomato_meter", "audience_score", "movie_duration", "production_budget", "opening_weekend", "domestic_box_office", "worldwide_box_office"];

    const scatterplotConfigDiv = graphConfigDiv.append("div").attr("id", "scatterplotConfig").style("width", "50%").style("display", "inline-block");
    scatterplotConfigDiv.append("h3").text("Scatterplot Configuration");

    scatterplotConfigDiv.append("span")
        .text("X Variable: ")
        .style("font-weight", "bold")
        .style("margin-right", "10px");

    scatterplotConfigDiv.append("select")
        .attr("id", "scatterplotXVar")
        .selectAll("option")
        .data(scatterplotVars)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d)
        .property("selected", d => d === scatterplotXVar);

    scatterplotConfigDiv.append("span")
        .text("Y Variable: ")
        .style("font-weight", "bold")
        .style("margin-right", "10px");

    scatterplotConfigDiv.append("select")
        .attr("id", "scatterplotYVar")
        .selectAll("option")
        .data(scatterplotVars)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d)
        .property("selected", d => d === scatterplotYVar);

    // Add dropdown for boxplot variable
    const boxplotConfigDiv = graphConfigDiv.append("div").attr("id", "boxplotConfig").style("width", "50%").style("display", "inline-block");
    boxplotConfigDiv.append("h3").text("Boxplot Configuration");

    boxplotConfigDiv.append("span")
        .text("Variable: ")
        .style("font-weight", "bold")
        .style("margin-right", "10px");

    boxplotConfigDiv.append("select")
        .attr("id", "boxplotVar")
        .selectAll("option")
        .data(scatterplotVars)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d)
        .property("selected", d => d === boxplotVar);

    // Add dropdown for boxplot sorting
    boxplotConfigDiv.append("span")
        .text("Sorted: ")
        .style("font-weight", "bold")
        .style("margin-right", "10px");

    const boxplotSortOptions = ["chronological", "highest-lowest", "lowest-highest"];

    boxplotConfigDiv.append("select")
        .attr("id", "boxplotSorted")
        .selectAll("option")
        .data(boxplotSortOptions)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d)
        .property("selected", d => d === boxplotSorted);

    // Add event listeners for dropdowns
    d3.select("#scatterplotXVar").on("change", function() {
        scatterplotXVar = this.value;
        renderPlots();
    });

    d3.select("#scatterplotYVar").on("change", function() {
        scatterplotYVar = this.value;
        renderPlots();
    });

    d3.select("#boxplotVar").on("change", function() {
        boxplotVar = this.value;
        renderPlots();
    });

    d3.select("#boxplotSorted").on("change", function() {
        boxplotSorted = this.value;
        renderPlots();
    });
}

/*----------------------
RENDER MOVIE LIST
----------------------*/
function renderMovieList() {
    movieListDiv = d3.select("#movie_list_div");
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
                .on("mouseover", () => {
                    hoveredMovie = movie;
                    updateHoveredMovie();
                })
                .on("mouseleave", () => {
                    hoveredMovie = null;
                    updateHoveredMovie();
                })
                .style("color", movie === hoveredMovie ? "orange" : movieSelection.includes(movie) ? "green" : "blue");
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
    renderPlots();
    renderNetworkGraph();
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
    renderPlots();
    renderNetworkGraph();
}

function updateNodeColors() {
    networkDiv.selectAll("circle")
        .attr("fill", d => getNodeColor(d));
}

function updateHoveredMovie() {
    let node = networkDiv.selectAll("circle");
    let link = networkDiv.selectAll("line");
    let neighbors = adjacency[hoveredMovie] || [];

    if (hoveredMovie) {
        
        // Update node opacity
        node.attr("opacity", n => (n.id === hoveredMovie || neighbors.includes(n.id)) ? 1 : 0.2);
        
        // Update link opacity
        link.attr("opacity", l => (l.source.id === hoveredMovie || l.target.id === hoveredMovie) ? 1 : 0.2);

        // Update node colors
        
        updateNodeColors();
        
        node.attr("fill", d => {
            if (d.id === hoveredMovie || neighbors.includes(d.id)) {
                return "orange";
            }
            return getNodeColor(d);
        });

        // Update link colors
        link.attr("stroke", l => {
            if (l.source.id === hoveredMovie || l.target.id === hoveredMovie) {
                return "orange"; // Links connected to hovered node
            } else {
                return "#999"; // Default link color
            }
        });

        const movieData = data.find(movie => movie.movie_title === hoveredMovie);
        if (movieData) {
            displayMovieInfo(movieData);
        }

        scatterPlotDiv.selectAll("circle")
            .attr("r", d => d.movie_title === hoveredMovie ? 15 : 5)
            .style("fill", d => d.movie_title === hoveredMovie ? "orange" : "#69b3a2");

        boxPlotDiv.selectAll("rect")
            .style("fill", d => d.movie_title === hoveredMovie ? "orange" : "#69b3a2");

    } else {
        // Reset node opacity and colors
        node.attr("opacity", 1)
            .attr("fill", d => movieSelection.includes(d.id) ? "green" : "blue"); // Restore colors based on selection

        updateNodeColors();
    
        node.attr("fill", d => {
            if (d.id === hoveredMovie || neighbors.includes(d.id)) {
                return "orange";
            }
            return getNodeColor(d);
        });

        // Reset link opacity and colors
        link.attr("opacity", 1)
            .attr("stroke", "#999"); 

        infoDiv.html(`<h2>Hover over a movie node to see details here.</h2>`);

        scatterPlotDiv.selectAll("circle")
            .attr("r", 5)
            .style("fill", "#69b3a2");

        boxPlotDiv.selectAll("rect")
            .style("fill", "#69b3a2");
    }

    var lis = document.getElementsByTagName("li");  
    for (var i = 0; i < lis.length; i++) {
        if (lis[i].textContent === hoveredMovie) {
            lis[i].style.color = "orange";
        } else if (movieSelection.includes(lis[i].textContent)) {
            lis[i].style.color = "green";
        } else {
            lis[i].style.color = "blue";
        }
    }
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

        filteredMovies = movieSelection;

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
            adjacency[l.target].push(l.source);
        });

        const svg = networkDiv.append("svg")
            .attr("width", width)
            .attr("height", height);

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(20)) 
            .force("charge", d3.forceManyBody()
                .distanceMax(d => d.group === "movie" ? 2 * radius : 2000 * radius)
                .strength(d => d.group === "movie" ? 50 : -50))
            .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1))
            .force("collide", d3.forceCollide()
                .radius(d => d.group === "movie" ? 3 * radius : 1.5 * radius)
                .strength(1))
            .force("radial", 
                d3.forceRadial(d => d.group === "movie" ? 0 : Math.min(width, height) / 2 , width / 2, height / 2)
                .strength(0.1));
;
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

            let r = d.group === "movie" ? 2 * radius : 0.8 * radius;

            svg.append("text")
                .attr("id", "hoveredText")
                .attr("x", d.x )
                .attr("y", d.y - 2 * r)
                .attr("fill", "white")
                .attr("text-anchor", "middle")
                .attr("font-size", "16px")
                .attr("font-weight", "bold")
                .attr("pointer-events", "none")
                .text(d.id);
        });

        node.on("mouseout", function() {
            hoveredMovie = null;
            updateHoveredMovie();

            // Remove the displayed text
            svg.select("#hoveredText").remove();
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
    // Clear existing SVG if any
    scatterPlotDiv.select("svg").remove();

    let filteredData = data.filter(d => movieSelection.includes(d.movie_title));

    const margin = { top: 40, right: 40, bottom: 60, left: 60 },
          plotWidth = 600,
          plotHeight = 400,
          width = plotWidth + margin.left + margin.right,
          height = plotHeight + margin.top + margin.bottom;

    const svg = scatterPlotDiv.append("svg")
        .attr("width", width)
        .attr("height", height)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale
    const x = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => +d[scatterplotXVar]) + 10])
        .range([0, plotWidth]);
    svg.append("g")
        .attr("transform", `translate(0,${plotHeight})`)
        .call(d3.axisBottom(x));

    // X Axis Label
    svg.append("text")             
        .attr("x", plotWidth / 2 )
        .attr("y", plotHeight + margin.bottom - 15)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Audience Score (%)");

    // Y Scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => +d[scatterplotYVar]) + 10])
        .range([plotHeight, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    // Y Axis Label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 20)
        .attr("x",0 - (plotHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Critics Score (%)");      

    // Plot Data Points
    svg.append('g')
        .selectAll("circle")
        .data(filteredData)
        .enter()
        .append("circle")
            .attr("cx", d => x(+d[scatterplotXVar]))
            .attr("cy", d => y(+d[scatterplotYVar]))
            .attr("r", 5)
            .style("fill", "#69b3a2")
            .on("mouseover", function(event, d) {
                hoveredMovie = d.movie_title;
                updateHoveredMovie();
            })
            .on("mouseout", function() {
                hoveredMovie = null;
                updateHoveredMovie();
            });

    // Title for Scatterplot
    svg.append("text")
        .attr("x", plotWidth / 2 )             
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
    // Clear existing SVG if any
    boxPlotDiv.select("svg").remove();

    let filteredData = data.filter(d => movieSelection.includes(d.movie_title));

    // Sorting Data
    if (boxplotSorted === "chronological") {
        filteredData.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));
    } else if (boxplotSorted === "highest-lowest") {
        filteredData.sort((a, b) => b[boxplotVar] - a[boxplotVar]);
    } else if (boxplotSorted === "lowest-highest") {
        filteredData.sort((a, b) => a[boxplotVar] - b[boxplotVar]);
    }

    const margin = { top: 40, right: 40, bottom: 100, left: 60 },
          plotWidth = 600,
          plotHeight = 400,
          width = plotWidth + margin.left + margin.right,
          height = plotHeight + margin.top + margin.bottom;

    const svg = boxPlotDiv.append("svg")
        .attr("width", width)
        .attr("height", height)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale
    const x = d3.scaleBand()
        .range([0, plotWidth])
        .domain(filteredData.map(d => d.movie_title))
        .padding(0.2);
    svg.append("g")
        .attr("transform", `translate(0,${plotHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")	
            .style("text-anchor", "end")
            .attr("dx", "-0.8em")
            .attr("dy", "-0.15em")
            .attr("transform", "rotate(-65)");

    // Y Scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => +d[boxplotVar]) * 1.1])
        .range([plotHeight, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    // Y Axis Label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 20)
        .attr("x",0 - (plotHeight / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Worldwide Box Office ($)");

    // Tooltip
    const tooltip = d3.select("body").append("div")	
        .attr("class", "tooltip")				
        .style("position", "absolute")
        .style("background", "#f4f4f4")
        .style("padding", "5px")
        .style("border", "1px solid #d4d4d4")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("opacity", 0);

    // Plot Bars
    svg.selectAll("mybar")
        .data(filteredData)
        .enter()
        .append("rect")
            .attr("x", d => x(d.movie_title))
            .attr("y", d => y(+d[boxplotVar]))
            .attr("width", x.bandwidth())
            .attr("height", d => plotHeight - y(+d[boxplotVar]))
            .attr("fill", "#69b3a2")
            .on("mouseover", function(event, d) {
                hoveredMovie = d.movie_title;
                updateHoveredMovie();
                
                tooltip.transition()		
                    .duration(200)		
                    .style("opacity", .9);		
                tooltip.html(`${d.movie_title}<br/>Box Office: $${d3.format(",")(d[boxplotVar])}`)
                    .style("left", (event.pageX) + "px")		
                    .style("top", (event.pageY - 28) + "px");	
            })
            .on("mouseout", function() {
                hoveredMovie = null;
                updateHoveredMovie();
                
                tooltip.transition()		
                    .duration(500)		
                    .style("opacity", 0);	
            });

    // Title for Boxplot
    svg.append("text")
        .attr("x", plotWidth / 2 )             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "16px") 
        .style("text-decoration", "underline")  
        .text("Worldwide Box Office by Release Order Boxplot");
}

/*----------------------
UPDATE GRAPHS BASED ON PHASE
----------------------*/
function renderPlots() {
    scatterPlotDiv.selectAll("*").remove();
    boxPlotDiv.selectAll("*").remove();

    renderScatterPlot();
    renderBoxPlot();
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
    }
    return "red";
}

