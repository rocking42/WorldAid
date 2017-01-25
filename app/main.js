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
    mapTexture
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
    countryYearsAndAid
} from './receivingD3'
import {
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
    findStackedData
} from './donatingD3'

const receivingAid = ["Nigeria","Iraq","Afghanistan","Pakistan","Congo, Dem. Rep.","Sudan","Ethiopia","Vietnam","Tanzania","Cameroon","Mozambique","Serbia","Uganda","Zambia","West Bank and Gaza","Indonesia","India","China","Ghana","Bangladesh","Morocco","Colombia","Kenya","Burkina Faso","Egypt","Mali","Senegal","Bolivia"];

const donating = ["Australia","Austria","Belgium","Canada","Denmark","Finland","France","Germany","Greece","Ireland","Italy","Japan","Luxembourg","Netherlands","New Zealand","Norway","Portugal","Spain","Sweden","Switzerland","United Kingdom","United States"];


// Store the results in a variable
function ready(error, results) {
    if (error) throw error;
    const [items, inNeed, dataWorld, crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policies, prodSectorAid, socialServ, waterAndSanitize, countryRanking, aidReceivedAll] = [results[0],results[1],results[2],results[3],results[4],results[5],results[6],results[7],results[8],results[9],results[10],results[11],results[12],results[13]];
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

    function addMaps(group, countries) {
        for (const country of countries) {
            if (country["aid-given"]) {
                let worldTexture = countTexture(country);
                let mapMaterial = new THREE.MeshPhongMaterial({
                    map: worldTexture,
                    transparent: true
                });
                var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
                baseMap.rotation.y = Math.PI;
                group.add(baseMap);
            }
        }
        return group
    }

    function addMapsInNeed(groupInNeed, countries) {
        for (const country of countries) {
            if (country["aid-received"]) {
                let worldTexture = countTexture(country);
                let mapMaterial = new THREE.MeshPhongMaterial({
                    map: worldTexture,
                    transparent: true
                });
                var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
                baseMap.rotation.y = Math.PI;
                groupInNeed.add(baseMap);
            }
        }
        return groupInNeed
    }

    // create a container node and add the two meshes
    var root = new THREE.Object3D();
    root.scale.set(2.5, 2.5, 2.5);
    root.add(baseGlobe);
    root.add(theWholeWorld);

    scene.add(root);

    function onGlobeClick(event) {

        // Get pointc, convert to latitude/longitude
        var latlng = getEventCenter.call(this, event);

        var country = geo.search(latlng[0], latlng[1]);
        // console.log(country.code);
        if (_.includes(receivingAid, country.code) && receivingAidActivated) {
            d3.select("#msg").text(country.code + " is recieving aid");
        } else if (_.includes(donating, country.code) && donatersActivated) {
            d3.select("#msg").text(country.code + " is a donator");
        } else if (receivingAidActivated) {
            d3.select("#msg").text("select a reciever");
        } else if (donatersActivated) {
            d3.select("#msg").text("select a donator");
        }


        if (country) {
            // d3.select("#msg").text(country.code);
            d3.select(".header").text(country.code);
            if (country["aid"]) {
                d3.select("#stats").text(country["aid"][2006])
            }
            if (country["recieved"]) {
                d3.select("#stats").text(country["recieved"])
            }
        }
    }

    setEvents(camera, [baseGlobe], 'click');
    setEvents(camera, [baseGlobe], 'mousemove', 10);

    let controls = new OrbitControls(
        camera,
        renderer.domElement
    );


    // donaters: addMaps(new THREE.Group(), countries.features),
    // receivingAid: addMapsInNeed(new THREE.Group(), countries.features)

    animate();
    // requestAnimationFrame(frameA);

    let receivingAidActivated = false;
    document.querySelector(".clearMap").addEventListener("click", function() {
    //   addSelected(receivingAid);
      receivingAidActivated = true;
      donatersActivated = false
    });

    let donatersActivated = false;
    document.querySelector(".showDonate").addEventListener("click", function() {
    //   addSelected(donaters);
      donatersActivated = true;
      receivingAidActivated = false;
    });

    // Get the two arrays
    const [years, aid] = countryYearsAndAid("Australia", items);

    const desCountry = years.map((year, i) => {
        let item = {
            year,
            aid: aid[i]
        }
        return item;
    });
    // Scale the range of the data
    x.domain(d3.extent(desCountry, function(d) { return d.year; }));
    y.domain([0, d3.max(desCountry, function(d) { return d.aid / 1000000; })]);
    // Add the valueline path.
    // var path = svgRecieve.append("path")
    //   	.attr("class", "line")
    // 		.attr("d", valueline(desCountry))

    const path = svgRecieve.data([ desCountry ])
    .append("path")
    .attr("class", "area usa")
    .attr("d", areaReceive)
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















    // RECEIVING LINE GRAPH
    // // Get the two arrays
    // const [years, aid] = countryYearsAndAid(country, data);
    //
    // const desCountry = years.map((year, i) => {
    //     let item = {
    //         year,
    //         aid: aid[i]
    //     }
    //     return item;
    // });
    // // Scale the range of the data
    // x.domain(d3.extent(desCountry, function(d) { return d.year; }));
    // y.domain([0, d3.max(desCountry, function(d) { return d.aid / 1000000; })]);
    // // Add the valueline path.
    // // var path = svgRecieve.append("path")
    // //   	.attr("class", "line")
    // // 		.attr("d", valueline(desCountry))
    //
    // const path = svgRecieve.data([ desCountry ])
    // .append("path")
    // .attr("class", "area usa")
    // .attr("d", areaReceive)
    // .attr("fill", "rgba(50, 195, 182, 0)")
    // .attr("stroke", "none");
    //
    //
    // var totalLength = path.node().getTotalLength();
    // path.attr("stroke-dasharray", totalLength + " " + totalLength)
    // .attr("stroke-dashoffset", totalLength)
    // .transition().duration(500)
    // .ease("linear")
    // .attr("stroke-dashoffset", 0)
    // .transition().duration(200)
    // .attr("fill", "rgba(50, 195, 182, 1)");
    //
    // // Add the X Axis
    // svg.append("g")
    // .attr("class", "x axis")
    // .attr("transform", "translate(0," + height + ")")
    // .call(xAxisReceive);
    //
    // // Add the Y Axis
    // svg.append("g")
    // .attr("class", "y axis")
    // .call(yAxisReceive);
















    // STACKED DONATERS
    // const [crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policiesAid, prodSectorAid, socialServ, waterAndSanitize] =
    // [data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7], data[8]]
    // const dataset = findStackedData("Germany", crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policiesAid, prodSectorAid, socialServ, waterAndSanitize);
    //
    // function displayNewStack(country) {
    //     const dataset2 = findStackedData(country, crossSector, ecoInfraStruct, eduAid, govAndCivil, health, policiesAid, prodSectorAid, socialServ, waterAndSanitize);
    //     var path = d3.selectAll("path").data(dataset2)
    //                         .attr("stroke", (d, i) => colorDonate(i))
    //                         .attr("fill", "#fff")
    //                         .attr("d", (d) => areaDonate(d.aid) )
    //
    //     const pathLength = path.node().getTotalLength();
    //     path.attr("stroke-dasharray", pathLength + " " + pathLength)
    //         .attr("stroke-dashoffset", pathLength)
    //         .transition().duration(300)
    //         .ease("linear")
    //         .attr("stroke-dashoffset", 0)
    //         .transition().duration(200)
    //         .attr("fill", (d, i) => colorDonate(i) )
    // }
    // // Data needs to look like this
    // // const dataShouldBe = [
    // // 	{ aidType: "exampleAidType", aidGivenToHealth: [
    // // 		{ x: "1961", y: 234234324342 },
    // // 		{ x: "1962", y: 234234324342 },
    // // 		{ x: "1963", y: 234234324342 }
    // // 	]},
    // // 	{ aidType: "exampleAidType", aidGivenToEd: [
    // // 		{ x: "1961", y: 234234324342 },
    // // 		{ x: "1962", y: 234234324342 },
    // // 		{ x: "1963", y: 234234324342 }
    // // 	]},
    // // 	{ aidType: "exampleAidType", aidGivenToInfra: [
    // // 		{ x: "1961", y: 234234324342 },
    // // 		{ x: "1962", y: 234234324342 },
    // // 		{ x: "1963", y: 234234324342 }
    // // 	]}
    // // ];
    // //Note that this is an array of objects. Each object
    // //contains two values, 'country' and 'emissions'.
    // //The 'emissions' value is itself an array, containing
    // //more objects, each one holding x and y values.
    // //
    // //The x (year) values have to be strings in this case,
    // //because the date format function expects a string
    // //to parse into a Date object.
    //
    // //New array with all the years, for referencing later
    // const years = ["1971", "1972", "1973", "1974", "1975", "1976", "1977", "1978", "1979", "1980", "1981", "1982", "1983", "1984", "1985", "1986", "1987", "1988", "1989", "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999", "2000", "2001", "2002", "2003", "2004", "2005", "2006", "2007"];
    // //Stack the data!
    //
    // //Now that the data is ready, we can check its
    // //min and max values to set our scales' domains!
    // xScaleDonate.domain([
    //     d3.min(years, function(d) {
    //         return dateFormat.parse(d);
    //     }),
    //     d3.max(years, function(d) {
    //         return dateFormat.parse(d);
    //     })
    // ]);
    //
    // //Need to recalcluate the max value for yScale
    // //differently, now that everything is stacked.
    //
    // //Loop once for each year, and get the total value
    // //of CO2 for that year.
    // const totals = [];
    //
    // for (i = 0; i < years.length; i++) {
    //     totals[i] = 0;
    //     for (j = 0; j < dataset.length; j++) {
    //         totals[i] += dataset[j].aid[i].y;
    //     }
    // }
    //
    // yScaleDonate.domain([ d3.max(totals), 0 ]);
    // //Areas
    // //
    // //Now that we are creating multiple paths, we can use the
    // //selectAll/data/co2/enter/append pattern to generate as many
    // //as needed.
    //
    // //Make a path for each country
    // var selection = svgDonate.selectAll("path")
    //     .data(dataset)
    //
    //     var paths = selection.enter()
    //     .append("path")
    //     .attr("class", "area")
    //     .attr("stroke", (d, i) => colorDonate(i))
    //     .attr("fill", "#fff")
    //     .attr("d", (d) => areaDonate(d.aid) )
    //
    //     var totalLength = paths.node().getTotalLength();
    //     paths.attr("stroke-dasharray", totalLength + " " + totalLength)
    //         .attr("stroke-dashoffset", totalLength)
    //         .transition().duration(300)
    //         .ease("linear")
    //     .attr("stroke-dashoffset", 0)
    //         .transition().duration(200)
    //         .attr("fill", (d, i) => colorDonate(i) );
    //
    // let stackCountry = ["Australia", "United States", "France", "Germany"]
    // d3.select("button").on("click", function() {
    //     displayNewStack(stackCountry[Math.floor(Math.random() * 4)])
    // })
    // // selection.enter().append("path");
    //
    //
    // //Append a title with the country name (so we get easy tooltips)
    // paths.append("title")
    //     .text(function(d) {
    //         return d.aidType;
    //     });
    //
    //
    //
    // //Create axes
    // svg.append("g")
    //     .attr("class", "x axis")
    //     .attr("transform", "translate(0," + (h - padding[2]) + ")")
    //     .call(xAxisDonate);
    //
    // svg.append("g")
    //     .attr("class", "y axis")
    //     .attr("transform", "translate(" + padding[3] + ",0)")
    //     .call(yAxisDonate);


























// function doSomething() {
//
//     var format = d3.time.format("%m/%d/%y");
//
//     var margin = {
//             top: 20,
//             right: 30,
//             bottom: 30,
//             left: 40
//         },
//         width = 960 - margin.left - margin.right,
//         height = 500 - margin.top - margin.bottom;
//
//     var x = d3.time.scale()
//         .range([0, width]);
//
//     var y = d3.scale.linear()
//         .range([height, 0]);
//
//     var z = d3.scale.category20c();
//
//     var xAxis = d3.svg.axis()
//         .scale(x)
//         .orient("bottom")
//         .ticks(d3.time.days);
//
//     var yAxis = d3.svg.axis()
//         .scale(y)
//         .orient("left");
//
//     var stack = d3.layout.stack()
//         .offset("zero")
//         .values(function(d) {
//             return d.values;
//         })
//         .x(function(d) {
//             return d.date;
//         })
//         .y(function(d) {
//             return d.value;
//         });
//
//     var nest = d3.nest()
//         .key(function(d) {
//             return d.key;
//         });
//
//     var area = d3.svg.area()
//         .interpolate("cardinal")
//         .x(function(d) {
//             return x(d.date);
//         })
//         .y0(function(d) {
//             return y(d.y0);
//         })
//         .y1(function(d) {
//             return y(d.y0 + d.y);
//         });
//
//     var svg = d3.select("#d3stuff").append("svg")
//         .attr("width", width + margin.left + margin.right)
//         .attr("height", height + margin.top + margin.bottom)
//         .append("g")
//         .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
//
//
//     function countryExtent(country, dataType) {
//         const res = dataType.filter((d) => d["aid-received"] === country);
//         const items = Object.values(res[0]).map((d) => +d);
//         const those = _.compact(items)
//         return [Math.min(...those), Math.max(...those)];
//     }
//
//     function countryYearsAndAid(country, dataType) {
//         const res = dataType.filter((d) => d["aid-received"] === country);
//         const money = Object.values(res[0]).map((d) => +d);
//         const years = Object.keys(res[0]).map((d) => d);
//         const yearsComp = years.splice(0, years.length - 1)
//         return [yearsComp, _.compact(money)];
//     }
//
//     d3.csv("../assets/Data3.csv", function(error, data) {
//         if (error) throw error;
//         // data.forEach(function(d) {
//         //     d.date = format.parse(d.date);
//         //     d.value = +d.value;
//         // });
//
//         const newData = countryYearsAndAid("Afghanistan", data);
//         const newYears = countryYearsAndAid[0];
//         const newMoney = countryYearsAndAid[1];
//         debugger
//         var layers = stack(nest.entries(data));
//
//         x.domain(d3.extent(data, function(d) {
//             return d.date;
//         }));
//         y.domain([0, d3.max(data, function(d) {
//             return d.y0 + d.y;
//         })]);
//
//         svg.selectAll(".layer")
//             .data(layers)
//             .enter().append("path")
//             .attr("class", "layer")
//             .attr("d", function(d) {
//                 return area(d.values);
//             })
//             .style("fill", function(d, i) {
//                 return z(i);
//             });
//
//         svg.append("g")
//             .attr("class", "x axis")
//             .attr("transform", "translate(0," + height + ")")
//             .call(xAxis);
//
//         svg.append("g")
//             .attr("class", "y axis")
//             .call(yAxis);
//     });
//     console.log("hello");
// }
//
// document.getElementById("doSomething").addEventListener("click", doSomething);
