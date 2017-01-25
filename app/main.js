const d3 = require("d3");
const _ = require("lodash")
const topojson = require("topojson");
const THREE = require("three");
const d3_queue = require("d3-queue");
const OrbitControls = require('three-orbit-controls')(THREE);
const $ = require("jquery");
import {
    memoize,
    debounce,
    getTween
} from './utils';
import {
    onWindowResize,
    canvas,
    renderer,
    camera,
    checkRotation,
    scene,
    light,
    animate,
    addSelected,
    removeGroups
} from './scene';
import {
    raycaster,
    setEvents
} from './events';
import {
    projection,
    getEventCenter,
    convertToXYZ,
    geodecoder
} from './helpers';
import {
    scaleColor,
    scaleInNeed,
    chooseColor,
    colorInNeed,
    countTexture,
    mapTexture,
    addMaps,
    addMapsInNeed
} from './textureAdd';
import {
    margin,
    height,
    width,
    parseDate,
    x,
    y,
    xAxisReceive,
    yAxisReceive,
    areaReceive,
    svgRecieve,
    countryYearsAndAid,
    changeCountryLine,
    findLineInfo
} from './receivingD3'
import {
    colorScheme,
    colorDescription,
    stack,
    w,
    h,
    padding,
    dateFormat,
    xScaleDonate,
    yScaleDonate,
    xAxisDonate,
    yAxisDonate,
    areaDonate,
    colorDonate,
    svgDonate,
    findStackedData,
    displayNewStack
} from './donatingD3'

const receivingAid = ["Nigeria", "Iraq", "Afghanistan", "Pakistan", "Congo, Dem. Rep.", "Sudan", "Ethiopia", "Vietnam", "Tanzania", "Cameroon", "Mozambique", "Serbia", "Uganda", "Zambia", "West Bank and Gaza", "Indonesia", "India", "China", "Ghana", "Bangladesh", "Morocco", "Colombia", "Kenya", "Burkina Faso", "Egypt", "Mali", "Senegal", "Bolivia"];

const donating = ["Australia", "Austria", "Belgium", "Canada", "Denmark", "Finland", "France", "Germany", "Greece", "Ireland", "Italy", "Japan", "Luxembourg", "Netherlands", "New Zealand", "Norway", "Portugal", "Spain", "Sweden", "Switzerland", "United Kingdom", "United States"];


// Store the results in a variable
function ready(error, results) {
    if (error) throw error;
    const [items, inNeed, dataWorld, crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policies, prodSectorAid, socialServ, waterAndSanitize, countryRanking, aidReceivedAll] = [results[0], results[1], results[2], results[3], results[4], results[5], results[6], results[7], results[8], results[9], results[10], results[11], results[12], results[13]];
    let segments = 155;

    scaleColor.domain(d3.extent(items, (d) => {
        return +d[2006];
    }));

    scaleInNeed.domain(d3.extent(inNeed, (d) => {
        if (+d[2006] > 916590000) {
            return +d[2006];
        }
    }));

    d3.select("#loading").transition().duration(500)
        .style("opacity", 0).remove();

    var currentCountry, overlay;

    // Setup cache for country textures
    var countries = topojson.feature(dataWorld, dataWorld.objects.countries);
    var geo = geodecoder(countries.features);

    // Iterate through all countries and match the data with the country
    for (const country of countries.features) {
        for (const item of items) {
            if (item["aid-given"] === country.id) {
                country["aid-given"] = item;
                // console.log(scaleColor(country["aid-given"][2006]));
            }
        }
        for (const need of inNeed) {
            if (need["aid-received"] === country.id && +need[2006] > 916590000) {
                country["aid-received"] = +need[2006];
            }
        }
    }

    var textureCache = memoize(function(cntryID, color) {
        var country = geo.find(cntryID);
        return mapTexture(country, color);
    });


    // Base globe with blue "water"
    let blueMaterial = new THREE.MeshPhongMaterial();
    blueMaterial.map = THREE.ImageUtils.loadTexture('../assets/earthlight.jpg');
    let sphere = new THREE.SphereGeometry(200, segments, segments);
    let baseGlobe = new THREE.Mesh(sphere, blueMaterial);
    baseGlobe.rotation.y = Math.PI;
    baseGlobe.name = "globe";
    baseGlobe.addEventListener('click', onGlobeClick);

    const outlineTexture = mapTexture(countries)
    const worldOutline = new THREE.MeshPhongMaterial({
        map: outlineTexture,
        transparent: true
    });
    const theWholeWorld = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), worldOutline);
    theWholeWorld.rotation.y = Math.PI;
    theWholeWorld.name = "worldOutline";

    // color legend
    function legend(colorDescription, colorScheme) {
        const legend = $("#legendMenu");
        legend.html("");
        console.log(colorDescription, colorScheme);
        colorScheme.forEach((color, i) => {
            const div = $("<div></div>").attr("class", "legendDiv");
            const tag = $(`<span></span>`).attr("class", "legendTag").css("background", color).appendTo(div);
            const span = $(`<span>&nbsp;- ${colorDescription[i]}</span>`).attr("class", "legendSpan").appendTo(div);
            legend.append(div);
            console.log("hello");
        });
    }

    // create a container node and add the two meshes
    var root = new THREE.Object3D();
    root.scale.set(2.5, 2.5, 2.5);
    root.add(baseGlobe);
    root.add(theWholeWorld);

    scene.add(root);

    $(".btn-3d").on("click", function() {
      $(".btn-3d").removeClass("activeButton");
      $(this).addClass("activeButton");
    });

    function onGlobeClick(event) {
        // Get pointc, convert to latitude/longitude
        var latlng = getEventCenter.call(this, event);
        var country = geo.search(latlng[0], latlng[1]);
        console.log(country.code);
        if (_.includes(receivingAid, country.code) && receivingAidActivated) {
            changeCountryLine(country.code, aidReceivedAll, "aid-received");
            d3.select("#donaterSvg").style("display", "none");
            let url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${country.code}&limit=1&namespace=0&format=json&callback=?`
            $.getJSON(url, function(data) {
                d3.select("#d3stuff .countryInfo").text(data[2][0]).style("display", "inline-block");
            });
            d3.select("#msg").text(country.code);
            d3.select("#stats").text(`Funds Recieved: ${country["recieved"]}$`);
            d3.select(".countryRank").style("display", "block");
            let rank = (countryRanking.filter((item) => item.country === country.code))
            rank.length > 0 ? rank = rank[0].ranking : rank = "?";
            d3.select(".countryRank").text(`${rank}/96`);
        } else if (_.includes(donating, country.code) && donatersActivated) {
            changeCountryLine(country.code, items, "aid-given");
            displayNewStack(country.code, crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policies, prodSectorAid, socialServ, waterAndSanitize);
            d3.select(".countryRank").style("display", "none");
            d3.select("#d3stuff .countryInfo").style("display", "none");
            d3.select("#donaterSvg").style("display", "inline");
            d3.select("#msg").text(country.code);
            d3.select("#stats").text(`Funds Donated: ${country["aid"][2006]}`);
        } else if (receivingAidActivated) {
            d3.select("#msg").text(`select a reciever`);
        } else if (donatersActivated) {
            d3.select("#msg").text(`select a donator`);
        }
    }

    setEvents(camera, [baseGlobe], 'click');
    setEvents(camera, [baseGlobe], 'mousemove', 10);

    let controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    // const donaters =  addMaps(new THREE.Group(), countries.features, "aid-given")
    // const aidLayers = addMaps(new THREE.Group(), countries.features, "aid-received")

    animate();
    // requestAnimationFrame(frameA);

    let receivingAidActivated = false;
    document.querySelector(".clearMap").addEventListener("click", function() {
        //   addSelected(receivingAid);
        if (!receivingAidActivated) {
            $("#legendMenu").html("");
            receivingAidActivated = true;
            donatersActivated = false;
            $(".rangeBarDonating").removeClass("active");
            $(".rangeBarRecieving").addClass("active");
        }
    });

    let donatersActivated = false;
    document.querySelector(".showDonate").addEventListener("click", function() {
        //   addSelected(donaters);
        if (!donatersActivated) {
            legend(colorDescription, colorScheme);
            receivingAidActivated = false;
            donatersActivated = true;
            $(".rangeBarRecieving").removeClass("active");
            $(".rangeBarDonating").addClass("active");
        }
    });

    const desCountry = findLineInfo("Germany", items, "aid-given")
        // Scale the range of the data
    x.domain(d3.extent(desCountry, function(d) {
        return d.year;
    }));
    y.domain([0, d3.max(desCountry, function(d) {
        return d.aid / 1000000;
    })]);

    const path = svgRecieve.data([desCountry])
        .append("path")
        .attr("class", "area usa")
        .attr("d", (d) => areaReceive(d))
        .attr("fill", "rgba(50, 195, 182, 0)")
        .attr("stroke", "none");

    var totalLength = path.node().getTotalLength();
    path.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition().duration(500)
        .ease("linear")
        .attr("stroke-dashoffset", 0)
        .transition().duration(200)
        .attr("fill", "rgba(50, 195, 182, 1)");

    // Add the X Axis
    svgRecieve.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxisReceive);

    // Add the Y Axis
    svgRecieve.append("g")
        .attr("class", "y axis")
        .call(yAxisReceive);

    const dataset = findStackedData("Germany", crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policies, prodSectorAid, socialServ, waterAndSanitize);

    //New array with all the years, for referencing later
    const yearsDonate = ["1971","1972","1973","1974","1975","1976","1977","1978","1979","1980","1981","1982","1983","1984","1985","1986","1987","1988","1989","1990","1991","1992","1993","1994","1995","1996","1997","1998","1999","2000","2001","2002","2003","2004","2005","2006","2007"];
    //Now that the data is ready, we can check its
    //min and max values to set our scales' domains!
    xScaleDonate.domain([
        d3.min(yearsDonate, function(d) {
            return dateFormat.parse(d);
        }),
        d3.max(yearsDonate, function(d) {
            return dateFormat.parse(d);
        })
    ]);

    //Loop once for each year, and get the total value
    //of All aid given for that year.
    const totals = [];

    for (let i = 0; i < yearsDonate.length; i++) {
        totals[i] = 0;
        for (let j = 0; j < dataset.length; j++) {
            totals[i] += dataset[j].aid[i].y;
        }
    }

    yScaleDonate.domain([d3.max(totals), 0]);
    //Areas
    //
    //Now that we are creating multiple paths, we can use the
    //selectAll/data/co2/enter/append pattern to generate as many
    //as needed.

    //Make a path for each country
    var selection = svgDonate.selectAll("path")
        .data(dataset)

    var paths = selection.enter()
        .append("path")
        .attr("class", "area")

        .attr("stroke", (d, i) => colorDonate(i))
        .attr("fill", "#fff")
        .attr("d", (d) => areaDonate(d.aid))

    var totalLength = paths.node().getTotalLength();
    paths.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition().duration(300)
        .ease("linear")
        .attr("stroke-dashoffset", 0)
        .transition().duration(200)
        .attr("fill", (d, i) => colorDonate(i));

    //Append a title with the country name (so we get easy tooltips)
    paths.append("title")
        .text(function(d) {
            return d.aidType;
        });

    //Create axes
    svgDonate.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + (h - padding[2]) + ")")
        .call(xAxisDonate);

    svgDonate.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(" + padding[3] + ",0)")
        .call(yAxisDonate);
}
// Load the data
d3_queue.queue()
    .defer(d3.csv, "../assets/data/aidGiven.csv")
    .defer(d3.csv, "../assets/data/aidReceivedShort.csv")
    .defer(d3.json, "../assets/data/world.json")
    .defer(d3.csv, "../assets/data/crossSector.csv")
    .defer(d3.csv, "../assets/data/ecoInfraStruct.csv")
    .defer(d3.csv, "../assets/data/eduAid.csv")
    .defer(d3.csv, "../assets/data/govAndCivil.csv")
    .defer(d3.csv, "../assets/data/health.csv")
    .defer(d3.csv, "../assets/data/policiesAid.csv")
    .defer(d3.csv, "../assets/data/prodSectorAid.csv")
    .defer(d3.csv, "../assets/data/socialServ.csv")
    .defer(d3.csv, "../assets/data/waterAndSanitize.csv")
    .defer(d3.csv, "../assets/data/countryRanking.csv")
    .defer(d3.csv, "../assets/data/aidReceivedLong.csv")
    .awaitAll(ready);
