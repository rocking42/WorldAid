const d3 = require("d3");
const topojson = require("topojson");
const THREE = require("three");
const d3_queue = require("d3-queue");



// UTILS

// adapted from memoize.js by @philogb and @addyosmani
function memoize(fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments);

    var key = "", len = args.length, cur = null;

    while (len--) {
      cur = args[len];
      key += (cur === Object(cur))? JSON.stringify(cur): cur;

      fn.memoize || (fn.memoize = {});
    }

    return (key in fn.memoize)? fn.memoize[key]:
    fn.memoize[key] = fn.apply(this, args);
  };
}

function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}

var getTween = function (prop, to, time) {
  time = time || 500;
  var node = this;
  var curr = node[prop];
  var interpol = d3.interpolateObject(curr, to);
  return function (t) {
    node[prop].copy(interpol(t / time));
    if (t >= time) {
      return true;
    }
  };
};


// MAP TEXTURE

var projection = d3.geo.equirectangular()
  .translate([1024, 512])
  .scale(325);



// SCENE

var canvas = d3.select("body").append("canvas")
  .attr("width", window.innerWidth)
  .attr("height", window.innerHeight);

canvas.node().getContext("webgl");

var renderer = new THREE.WebGLRenderer({canvas: canvas.node(), antialias: true});

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 1000;

var scene = new THREE.Scene();

var light = new THREE.HemisphereLight('#ffffff', '#666666', 1.5);
light.position.set(0, 1000, 0);
scene.add(light);

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}



// SETEVENTS

let raycaster = new THREE.Raycaster();

function setEvents(camera, items, type, wait) {

  let listener = function(event) {

    let mouse = {
      x: ((event.clientX - 1) / window.innerWidth ) * 2 - 1,
      y: -((event.clientY - 1) / window.innerHeight) * 2 + 1
    };

    let vector = new THREE.Vector3();
    vector.set(mouse.x, mouse.y, 0.5);
    vector.unproject(camera);

    raycaster.ray.set(camera.position, vector.sub(camera.position).normalize());

    let target = raycaster.intersectObjects(items);

    if (target.length) {
      target[0].type = type;
      target[0].object.dispatchEvent(target[0]);
    }

  };

  if (!wait) {
    document.addEventListener(type, listener, false);
  } else {
    document.addEventListener(type, debounce(listener, wait), false);
  }
}



// GEOHELPERS


function getPoint(event) {

  // Get the vertices
  let a = this.geometry.vertices[event.face.a];
  let b = this.geometry.vertices[event.face.b];
  let c = this.geometry.vertices[event.face.c];

  // Averge them together
  let point = {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
    z: (a.z + b.z + c.z) / 3
  };

  return point;
}

function getEventCenter(event, radius) {
  radius = radius || 200;

  var point = getPoint.call(this, event);

  var latRads = Math.acos(point.y / radius);
  var lngRads = Math.atan2(point.z, point.x);
  var lat = (Math.PI / 2 - latRads) * (180 / Math.PI);
  var lng = (Math.PI - lngRads) * (180 / Math.PI);

  return [lat, lng - 180];
}

function convertToXYZ(point, radius) {
  radius = radius || 200;

  var latRads = ( 90 - point[0]) * Math.PI / 180;
  var lngRads = (180 - point[1]) * Math.PI / 180;

  var x = radius * Math.sin(latRads) * Math.cos(lngRads);
  var y = radius * Math.cos(latRads);
  var z = radius * Math.sin(latRads) * Math.sin(lngRads);

  return {x: x, y: y, z: z};
}

var geodecoder = function (features) {

  let store = {};

  for (let i = 0; i < features.length; i++) {
    store[features[i].id] = features[i];
  }

  return {
    find: function (id) {
      return store[id];
    },
    search: function (lat, lng) {

      let match = false;

      let country, coords;

      for (let i = 0; i < features.length; i++) {
        country = features[i];
        if(country.geometry.type === 'Polygon') {
          match = pointInPolygon(country.geometry.coordinates[0], [lng, lat]);
          if (match) {
            // Attach values or undefined to country
            return {
              code: features[i].id,
              name: features[i].properties.name,
              aid: features[i]["aid-given"],
              recieved: features[i]["aid-received"]
            };
          }
        } else if (country.geometry.type === 'MultiPolygon') {
          coords = country.geometry.coordinates;
          for (let j = 0; j < coords.length; j++) {
            match = pointInPolygon(coords[j][0], [lng, lat]);
            if (match) {
              // Attach values or undefined to country
              return {
                code: features[i].id,
                name: features[i].properties.name,
                aid: features[i]["aid-given"],
                recieved: features[i]["aid-received"]
              };
            }
          }
        }
      }

      return null;
    }
  };
};

// http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
var pointInPolygon = function(poly, point) {

  let x = point[0];
  let y = point[1];

  let inside = false, xi, xj, yi, yj, xk;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    xi = poly[i][0];
    yi = poly[i][1];
    xj = poly[j][0];
    yj = poly[j][1];

    xk = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (xk) {
       inside = !inside;
    }
  }

  return inside;
};



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






let items, inNeed, data;
// Store the results in a variable
function ready(error, results) {
  if (error) throw error;
  items = results[0];
  inNeed = results[1];
  data = results[2];

  var scaleColor = d3.scale.log()
                           .domain(d3.extent(items, (d) => {
                            return +d[2006];
                           }))
                           .interpolate(d3.interpolateHcl)
                           .range([d3.rgb("#e5f5e0"), d3.rgb('#31a354')]);

  var scaleInNeed = d3.scale.log()
                           .domain(d3.extent(inNeed, (d) => {
                            if(+d[2006] > 1350000000) {
                              return +d[2006];
                            }
                           }))
                           .interpolate(d3.interpolateHcl)
                           .range([d3.rgb("#fee8c8"), d3.rgb('#e34a33')]);

  var chooseColor = function(country) {
    let result;
    if(country["aid-given"]) {
      console.log(country["aid-given"][2006]);
      result = scaleColor(country["aid-given"][2006]);
    }
    return result;
  };

  var colorInNeed = function(country) {
    let result;
    if(country["aid-received"]) {
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
  for(const country of countries.features) {
    for (const item of items) {
      if(item["aid-given"] === country.id){
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

  var textureCache = memoize(function (cntryID, color) {
    var country = geo.find(cntryID);
    return mapTexture(country, color);
  });

  // Base globe with blue "water"
  let blueMaterial = new THREE.MeshPhongMaterial();
  blueMaterial.map = THREE.ImageUtils.loadTexture('earthlight.jpg');
  let sphere = new THREE.SphereGeometry(200, segments, segments);
  let baseGlobe = new THREE.Mesh(sphere, blueMaterial);
  baseGlobe.rotation.y = Math.PI;
  baseGlobe.name = "globe";
  baseGlobe.addEventListener('click', onGlobeClick);

  // baseGlobe.addEventListener('click', onGlobeMousemove);

  const outlineTexture = mapTexture(countries)
  const worldOutline = new THREE.MeshPhongMaterial({map: outlineTexture , transparent: true});
  const theWholeWorld = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), worldOutline);
  theWholeWorld.rotation.y = Math.PI;
  theWholeWorld.name = "worldOutline";
  // var group = new THREE.Group();
  // var groupInNeed = new THREE.Group();

  function addMaps(group, countries) {
    for (const country2 of countries) {
      if (country2["aid-given"]) {
        let worldTexture2 = countTexture(country2);
        let mapMaterial2  = new THREE.MeshPhongMaterial({map: worldTexture2, transparent: true});
        var baseMap2 = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial2);
        baseMap2.rotation.y = Math.PI;
        group.add( baseMap2 );
      }
    }
    return group
  }

  function addMapsInNeed(groupInNeed, countries) {
    for (const country of countries) {
      if (country["aid-received"]) {
        let worldTexture = countTexture(country);
        let mapMaterial  = new THREE.MeshPhongMaterial({map: worldTexture, transparent: true});
        var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
        baseMap.rotation.y = Math.PI;
        groupInNeed.add( baseMap );
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
      material = new THREE.MeshPhongMaterial({map: map, transparent: true});
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

  function animate() {
    // All meshes are stored here
    // scene.children[1].children
    // example of looping through child elements and removing them
    // scene.children[1].remove(scene.children[1].children[1])
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  function removeGroups() {
    if (scene.children[1].children[2]) {
      scene.children[1].remove(scene.children[1].children[2]);
    }
  }


  function animate2() {
    removeGroups();
    window.setTimeout(() => {
      const receivingAid = addMapsInNeed(new THREE.Group(), countries.features);
      scene.children[1].add(receivingAid);
    }, 2000)
  }

  function animate3() {
    removeGroups();
    window.setTimeout(() => {
      const donaters = addMaps(new THREE.Group(), countries.features);
      scene.children[1].add(donaters);
    }, 2000)
  }

  animate();

  document.querySelector(".clearMap").addEventListener("click", function() {
    console.log("happy");
    animate2();
  });
  document.querySelector(".showDonate").addEventListener("click", function() {
    console.log("happy");
    animate3();
  });

}



// Load the data
d3_queue.queue()
        .defer(d3.csv, "Data1.csv")
        .defer(d3.csv, "Data3.csv")
        .defer(d3.json, "world.json")
        .awaitAll(ready);
