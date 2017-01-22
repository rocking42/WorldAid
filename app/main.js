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
              aid: features[i]["aid-given"]
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
                aid: features[i]["aid-given"]
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

let items;
// Store the results in a variable
function ready(error, results) {
  if (error) throw error;
  items = results;
}
// Load the data
d3_queue.queue()
        .defer(d3.csv, "Data1.csv")
        .await(ready);


















// MAIN
d3.json('world.json', function (err, data) {

    var scaleColor = d3.scale.linear()
                             .domain(d3.extent(items, (d) => d[2007]))
                             .range(["#ff0000", "#00ff00"]);

    var chooseColor = function(country) {
      let result;
      if(country["aid-given"]) {
        result = scaleColor(country["aid-given"][2007]);
      } else {
        result = "#fff";
      }
    };

  //  var chooseColor = function(country) {
  //    if(country["aid-given"]) {
  //      let result = scaleColor(country["aid-given"][2007]);
  //    } return result;
  //  };


   function mapTexture(geojson, color) {
     var texture, context, canvas;

     //
    //  for(const geo of geojson.features) {
    //    // TODO:
    //    chooseColor(geo);
    //  }

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
     context.fillStyle = color || "#CDB380";

     context.beginPath();

     path(geojson);

     if (color) {
       context.fill();
     }

     context.stroke();

     // DEBUGGING - Really expensive, disable when done.
     // console.log(canvas.node().toDataURL());

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
        // console.log(scaleColor(country["aid-given"][2007]));
      }
    }
  }
  // console.log(countries);

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
  baseGlobe.addEventListener('click', onGlobeClick);
  baseGlobe.addEventListener('mousemove', onGlobeMousemove);

  // add base map layer with all countries
  // let worldTexture = mapTexture(countries, '#647089');
  let worldTexture = mapTexture(countries);
  let mapMaterial  = new THREE.MeshPhongMaterial({map: worldTexture, transparent: true});
  var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
  baseMap.rotation.y = Math.PI;

  // create a container node and add the two meshes
  var root = new THREE.Object3D();
  root.scale.set(2.5, 2.5, 2.5);
  root.add(baseGlobe);
  root.add(baseMap);
  scene.add(root);

  function onGlobeClick(event) {

    // Get pointc, convert to latitude/longitude
    var latlng = getEventCenter.call(this, event);
    var country = geo.search(latlng[0], latlng[1]);
    console.log(country);

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

  function colorOnLoad(event) {
    // console.log(countries);
    // // Get pointc, convert to latitude/longitude
    // var latlng = getEventCenter.call(this, event);
    // var country = geo.search(latlng[0], latlng[1]);
    // console.log(country);
    //
    // // Get new camera position
    // var temp = new THREE.Mesh();
    // temp.position.copy(convertToXYZ(latlng, 900));
    // temp.lookAt(root.position);
    // temp.rotateY(Math.PI);
    //
    // for (let key in temp.rotation) {
    //   if (temp.rotation[key] - camera.rotation[key] > Math.PI) {
    //     temp.rotation[key] -= Math.PI * 2;
    //   } else if (camera.rotation[key] - temp.rotation[key] > Math.PI) {
    //     temp.rotation[key] += Math.PI * 2;
    //   }
    // }
    //
    // var tweenPos = getTween.call(camera, 'position', temp.position);
    // d3.timer(tweenPos);
    //
    // var tweenRot = getTween.call(camera, 'rotation', temp.rotation);
    // d3.timer(tweenRot);
  }

  function onGlobeMousemove(event) {
    var map, material;

    // Get pointc, convert to latitude/longitude
    var latlng = getEventCenter.call(this, event);

    // Look for country at that latitude/longitude
    var country = geo.search(latlng[0], latlng[1]);

    if (country !== null && country.code !== currentCountry) {

      // Track the current country displayed
      currentCountry = country.code;

      // Update the html
      d3.select("#msg").html(country.code);

       // Overlay the selected country
      map = textureCache(country.code, '#ec8c47');
      material = new THREE.MeshPhongMaterial({map: map, transparent: true});
      if (!overlay) {
        overlay = new THREE.Mesh(new THREE.SphereGeometry(201, 40, 40), material);
        overlay.rotation.y = Math.PI;
        root.add(overlay);
      } else {
        overlay.material = material;
      }
    }
  }

  setEvents(camera, [baseGlobe], 'click');
  setEvents(camera, [baseGlobe], 'mousemove', 10);
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
