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
    light
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


let items, inNeed, data;
// Store the results in a variable
function ready(error, results) {
    if (error) throw error;
    items = results[0];
    inNeed = results[1];
    data = results[2];

    function mapTexture(geojson, color) {
        color = '#f00'
        var texture, context, canvas;
        canvas = d3.select("body").append("canvas")
            .style("display", "none")
            .attr("width", "2048px")
            .attr("height", "1024px");

        context = canvas.node().getContext("2d");

        var path = d3.geo.path()
            .projection(projection)
            .context(context);

        context.strokeStyle = "#333";
        context.lineWidth = 1;


        context.beginPath();

        path(geojson);

        context.stroke();

        // DEBUGGING - Really expensive, disable when done.
        // console.log(canvas.node().toDataURL());

        texture = new THREE.Texture(canvas.node());
        texture.needsUpdate = true;

        canvas.remove();

        return texture;
    }


    var scaleColor = d3.scale.log()
        .domain(d3.extent(items, (d) => {
            return +d[2006];
        }))
        .interpolate(d3.interpolateHcl)
        .range([d3.rgb("#e5f5e0"), d3.rgb('#31a354')]);

    var scaleInNeed = d3.scale.log()
        .domain(d3.extent(inNeed, (d) => {
            if (+d[2006] > 1350000000) {
                return +d[2006];
            }
        }))
        .interpolate(d3.interpolateHcl)
        .range([d3.rgb("#fee8c8"), d3.rgb('#e34a33')]);

    var chooseColor = function(country) {
        let result;
        if (country["aid-given"]) {
            console.log(country["aid-given"][2006]);
            result = scaleColor(country["aid-given"][2006]);
        }
        return result;
    };

    var colorInNeed = function(country) {
        let result;
        if (country["aid-received"]) {
            console.log(country["aid-received"]);
            result = scaleInNeed(country["aid-received"]);
        }
        return result;
    };


    function countTexture(country) {
        let color;
        if (country["aid-given"]) {
            color = chooseColor(country);
        } else if (country["aid-received"]) {
            color = colorInNeed(country);
            console.log(color);
        }
        var texture, context, canvas;
        canvas = d3.select("body").append("canvas")
            .style("display", "none")
            .attr("width", "2048px")
            .attr("height", "1024px");

        context = canvas.node().getContext("2d");

        var path = d3.geo.path()
            .projection(projection)
            .context(context);

        context.strokeStyle = "#333";
        context.lineWidth = 1;

        context.fillStyle = color;

        context.beginPath();


        path(country);
        context.fill();

        context.stroke();

        texture = new THREE.Texture(canvas.node());
        texture.needsUpdate = true;

        canvas.remove();

        return texture;
    }


    d3.select("#loading").transition().duration(500)
        .style("opacity", 0).remove();

    var currentCountry, overlay;

    var segments = 155; // number of vertices. Higher = better mouse accuracy

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
            if (need["aid-received"] === country.id && +need[2006] > 1350000000) {
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
    // var group = new THREE.Group();
    // var groupInNeed = new THREE.Group();

    function addMaps(group, countries) {
        for (const country2 of countries) {
            if (country2["aid-given"]) {
                let worldTexture2 = countTexture(country2);
                let mapMaterial2 = new THREE.MeshPhongMaterial({
                    map: worldTexture2,
                    transparent: true
                });
                var baseMap2 = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial2);
                baseMap2.rotation.y = Math.PI;
                group.add(baseMap2);
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

    const receivingAid = addMapsInNeed(new THREE.Group(), countries.features);
  const donaters = addMaps(new THREE.Group(), countries.features);

  var fps = 30;
  function animate() {
    setTimeout(function() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }, 1000 / fps);
  }

  function removeGroups( toRemove ) {
    if (scene.children[1].children[2]) {
      scene.children[1].remove(scene.children[1].children[2]);
    }
  }


  function animate2() {
    removeGroups();
    window.setTimeout(() => {
      scene.children[1].add(receivingAid);
    }, 200);
  }

   function animate3() {
     removeGroups();
     window.setTimeout(() => {
       scene.children[1].add(donaters);
     }, 200);
   }

   animate();

   document.querySelector(".clearMap").addEventListener("click", function() {
     animate2();
   });
   document.querySelector(".showDonate").addEventListener("click", function() {
     animate3();
   });

}
// Load the data
d3_queue.queue()
    .defer(d3.csv, "/../assets/Data1.csv")
    .defer(d3.csv, "/../assets/Data4.csv")
    .defer(d3.json, "/../assets/world.json")
    .awaitAll(ready);
