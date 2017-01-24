const d3 = require("d3");
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
            if (country["aid"]) {
                d3.select("#stats").text(country["aid"][2006])
            }
            if (country["recieved"]) {
                d3.select("#stats").text(country["recieved"])
            }
        }

        // Get new camera position
        var temp = new THREE.Mesh();
        temp.position.copy(convertToXYZ(latlng, 900));
        temp.lookAt(root.position);
        temp.rotateY(Math.PI);

        for (let key in temp.rotation) {
            if (temp.rotation[key] - camera.rotation[key] > Math.PI) {
                temp.rotation[key] -= Math.PI * 2;
            } else if (camera.rotation[key] - temp.rotation[key] > Math.PI) {
                temp.rotation[key] += Math.PI * 2;
            }
        }

        var tweenPos = getTween.call(camera, 'position', temp.position);
        d3.timer(tweenPos);

        var tweenRot = getTween.call(camera, 'rotation', temp.rotation);
        d3.timer(tweenRot);
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

  const aidGroups = {
    donaters: addMaps(new THREE.Group(), countries.features),
    receivingAid: addMapsInNeed(new THREE.Group(), countries.features)
  };

   animate();
   // requestAnimationFrame(frameA);

   document.querySelector(".clearMap").addEventListener("click", function() {
     addSelected(aidGroups.receivingAid);
   });
   document.querySelector(".showDonate").addEventListener("click", function() {
     addSelected(aidGroups.donaters);
   });

}
// Load the data
d3_queue.queue()
    .defer(d3.csv, "../assets/Data1.csv")
    .defer(d3.csv, "../assets/Data5.csv")
    .defer(d3.json, "../assets/world.json")
    .awaitAll(ready);
