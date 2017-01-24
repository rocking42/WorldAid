const d3 = require("d3");
const THREE = require("three");

export var canvas = d3.select("body").append("canvas")
  .attr("width", window.innerWidth)
  .attr("height", window.innerHeight);

canvas.node().getContext("webgl");

export var renderer = new THREE.WebGLRenderer({canvas: canvas.node(), antialias: true});

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

export var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 600;
camera.position.x = -750;
camera.position.y = 400;

export var scene = new THREE.Scene();

export var light = new THREE.HemisphereLight('0xffffff', '0xffffff', 1.5);
light.position.set(0, 1000, 0);
scene.add(light);

window.addEventListener('resize', onWindowResize, false);

export function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const fps = 30;
export function animate() {
  setTimeout(function() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }, 1000 / fps);
}

// Function to aid in garbage collection
// export function frameA() {
//     requestAnimationFrame(frameB);
//     renderer.render(scene, camera);
//   };
// export function frameB() {
//     requestAnimationFrame(frameA);
//     renderer.render(scene, camera);
//   };


export function removeGroups( toRemove ) {
  if (scene.children[1].children[2]) {
    scene.children[1].remove(scene.children[1].children[2]);
  }
}

export function addSelected(highlighted) {
  removeGroups();
  window.setTimeout(() => {
    scene.children[1].add(highlighted);
  }, 0);
}
