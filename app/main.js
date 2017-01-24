const d3 = require("d3");
const _ = require("lodash")
const topojson = require("topojson");
const THREE = require("three");
const d3_queue = require("d3-queue");
const OrbitControls = require('three-orbit-controls')(THREE);
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
} from './textureAdd'

// Store the results in a variable
function ready(error, results) {
    if (error) throw error;
    const items = results[0];
    const inNeed = results[1];
    const data = results[2];
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
    var countries = topojson.feature(data, data.objects.countries);
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

    // baseGlobe.addEventListener('click', onGlobeMousemove);

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
        // console.log(country);
        if (country) {
            d3.select("#msg").text(country.code);
            d3.select(".header").text(country.code);
            if (country["aid"]) {
                d3.select("#stats").text(country["aid"][2006])
            }
            if (country["recieved"]) {
                d3.select("#stats").text(country["recieved"])
            }
        }
    }

    function onGlobeMousemove(event) {
        var map, material;

        // Get pointc, convert to latitude/longitude
        var latlng = getEventCenter.call(this, event);

        // Look for country at that latitude/longitude
        var country = geo.search(latlng[0], latlng[1]);
        console.log(country);
        if (country !== null && country.code !== currentCountry) {

            // Track the current country displayed
            currentCountry = country.code;

            // Update the html
            d3.select("#msg").html(country.code);

            // Overlay the selected country
            map = textureCache(country.code);
            material = new THREE.MeshPhongMaterial({
                map: map,
                transparent: true
            });
            // if (!overlay) {
            //   overlay = new THREE.Mesh(new THREE.SphereGeometry(201, 40, 40), material);
            //   overlay.rotation.y = Math.PI;
            //   root.add(overlay);
            // } else {
            //   overlay.material = material;
            // }
        }
    }

    setEvents(camera, [baseGlobe], 'click');
    setEvents(camera, [baseGlobe], 'mousemove', 10);

    let controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    // const donaters = addMaps(new THREE.Group(), countries.features);
    // const receivingAid = addMapsInNeed(new THREE.Group(), countries.features);

    animate();
    // requestAnimationFrame(frameA);

    // document.querySelector(".clearMap").addEventListener("click", function() {
    //   addSelected(receivingAid);
    // });
    // document.querySelector(".showDonate").addEventListener("click", function() {
    //   addSelected(donaters);
    // });

}
// Load the data
d3_queue.queue()
    .defer(d3.csv, "../assets/Data1.csv")
    .defer(d3.csv, "../assets/Data5.csv")
    .defer(d3.json, "../assets/world.json")
    .awaitAll(ready);



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
