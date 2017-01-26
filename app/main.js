const d3 = require("d3");
const _ = require("lodash")
const topojson = require("topojson");
const THREE = require("three");
const d3_queue = require("d3-queue");
const OrbitControls = require('three-orbit-controls')(THREE);
const $ = require("jquery");
// Utility functions
import {
    memoize,
    debounce,
    getTween
} from './utils';
// Initial scene setup functions
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
// 3D click functions
import {
    raycaster,
    setEvents
} from './events';
// Various THREEjs helpers
import {
    projection,
    getEventCenter,
    convertToXYZ,
    geodecoder
} from './helpers';
// Import the texture rendering functions
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
// Import the stacked graph data
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
    displayNewStack,
    showStack
} from './donatingD3'
// Import the single area graph functions
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
    findLineInfo,
    showLine
} from './receivingD3'

// Store the results in a variable
function ready(error, results) {
    if (error) throw error;
    const [items, inNeed, dataWorld, crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policies, prodSectorAid, socialServ, waterAndSanitize, countryRanking, aidReceivedAll] = [results[0], results[1], results[2], results[3], results[4], results[5], results[6], results[7], results[8], results[9], results[10], results[11], results[12], results[13]];
    // Hard coded arrays of recipients and donaters
    const receivingAid = ["Nigeria","Iraq","Afghanistan","Pakistan","Congo,Dem.Rep.","Sudan","Ethiopia","Vietnam","Tanzania","Cameroon","Mozambique","Serbia","Uganda","Zambia","WestBankandGaza","Indonesia","India","China","Ghana","Bangladesh","Morocco","Colombia","Kenya","BurkinaFaso","Egypt","Mali","Senegal","Bolivia"];

    const donating = ["Australia","Austria","Belgium","Canada","Denmark","Finland","France","Germany","Greece","Ireland","Italy","Japan","Luxembourg","Netherlands","New Zealand","Norway","Portugal","Spain","Sweden","Switzerland","United Kingdom","United States"];

    let segments = 40;


    // Setup cache for country textures
    const countries = topojson.feature(dataWorld, dataWorld.objects.countries);
    const geo = geodecoder(countries.features);

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

    // Base globe with blue "water"
    let blueMaterial = new THREE.MeshPhongMaterial();
    blueMaterial.map = THREE.ImageUtils.loadTexture('../assets/earthlight.jpg');
    let sphere = new THREE.SphereGeometry(200, segments, segments);
    let baseGlobe = new THREE.Mesh(sphere, blueMaterial);
    baseGlobe.rotation.y = Math.PI;
    baseGlobe.name = "globe";
    baseGlobe.addEventListener('click', onGlobeClick);
    // Grab the outline textures and add it to the scene
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
        });
    }

    // create a container node and add the two meshes
    const root = new THREE.Object3D();
    root.scale.set(2.5, 2.5, 2.5);
    root.add(baseGlobe);
    root.add(theWholeWorld);

    scene.add(root);

    $(".btn-3d").on("click", function() {
      $(".btn-3d").removeClass("activeButton");
      $(this).addClass("activeButton");
    });
    // Country click events
    function onGlobeClick(event) {
        // Get pointc, convert to latitude/longitude
        const latlng = getEventCenter.call(this, event);
        const country = geo.search(latlng[0], latlng[1]);
        console.log(country.code);
        // Validate whether a country is a recipient/donater/not affected
        if (_.includes(receivingAid, country.code) && receivingAidActivated) {
            // Update the area graph
            changeCountryLine(country.code, aidReceivedAll, "aid-received");
            // Hide the stack graph
            d3.select("#donaterSvg").style("display", "none");
            // Wikipedia data
            let url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${country.code}&limit=1&namespace=0&format=json&callback=?`
            $.getJSON(url, function(data) {
                // Add wiki text
                d3.select("#d3stuff .countryInfo").text(data[2][0]).style("display", "inline-block");
            });
            d3.select("#msg").text(country.code);
            d3.select("#stats").text(`Funds Recieved: $${country["recieved"]}`);
            d3.select(".countryRank").style("display", "block");
            // Grap the rank of the country or ? if no data present
            let rank = (countryRanking.filter((item) => item.country === country.code))
            rank.length > 0 ? rank = rank[0].ranking : rank = "?";
            d3.select(".countryRank").text(`${rank}/96`);
        } else if (_.includes(donating, country.code) && donatersActivated) {
            // Update the area graph
            changeCountryLine(country.code, items, "aid-given");
            // Update the stack graph and display it if hidden
            displayNewStack(country.code, crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policies, prodSectorAid, socialServ, waterAndSanitize);
            d3.select("#donaterSvg").style("display", "inline");
            // Hide the rank and info
            d3.select(".countryRank").style("display", "none");
            d3.select("#d3stuff .countryInfo").style("display", "none");
            d3.select("#msg").text(country.code);
            d3.select("#stats").text(`Funds Donated: ${country["aid"][2006]}`);
            // else Helpful message
        } else if (receivingAidActivated) {
            d3.select("#msg").text(`select a reciever`);
        } else if (donatersActivated) {
            d3.select("#msg").text(`select a donator`);
        }
    }
    // Add event listeners to the globe
    setEvents(camera, [baseGlobe], 'click');
    setEvents(camera, [baseGlobe], 'mousemove', 10);
    // Allow the globe to be dragged around
    let controls = new OrbitControls(
        camera,
        renderer.domElement
    );
    // Texture layer load
    const donaters =  addMaps(new THREE.Group(), countries.features, "aid-given")
    const aidLayers = addMaps(new THREE.Group(), countries.features, "aid-received")

    animate();
    // requestAnimationFrame(frameA);

    // LAYER TOGGLES
    // AID RECEIVE LAYERS
    let receivingAidActivated = false;
    document.querySelector(".clearMap").addEventListener("click", function() {
          addSelected(aidLayers);
        if (!receivingAidActivated) {
            $("#legendMenu").html("");
            receivingAidActivated = true;
            donatersActivated = false;
            $(".rangeBarDonating").removeClass("active");
            $(".rangeBarRecieving").addClass("active");
        }
    });

    // Loading screen
    // d3.select(".newLoader").style("display", "none").remove();

    d3.select(".container").style("display", "inline");
    d3.select("canvas").style("display", "inline");

    // AID DONATE LAYERS
    let donatersActivated = false;
    document.querySelector(".showDonate").addEventListener("click", function() {
          addSelected(donaters);
        if (!donatersActivated) {
            legend(colorDescription, colorScheme);
            receivingAidActivated = false;
            donatersActivated = true;
            $(".rangeBarRecieving").removeClass("active");
            $(".rangeBarDonating").addClass("active");
        }
    });

  // Add the data to the scales
  scaleColor.domain(d3.extent(items, (d) => {
      return +d[2006];
  }));

  scaleInNeed.domain(d3.extent(inNeed, (d) => {
      if (+d[2006] > 916590000) {
          return +d[2006];
      }
  }));
  // Find the area data needed for the line area graph
  const desCountry = findLineInfo("Germany", items, "aid-given")
  // Display the initial single area Graph
  showLine(desCountry);
  // Grab the data for the initial setup stack graph
  const dataset = findStackedData("Germany", crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policies, prodSectorAid, socialServ, waterAndSanitize);
  // Display the stacked graph using the data
  showStack(dataset);
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
