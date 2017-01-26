const THREE = require("three");
const d3 = require("d3");
import {
    projection,
    geodecoder
} from './helpers';

export function mapTexture(geojson, color) {
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

export const scaleColor = d3.scale.log()
    .interpolate(d3.interpolateHcl)
    .range([d3.rgb("#e5f5e0"), d3.rgb('#31a354')]);

export const scaleInNeed = d3.scale.log()
.interpolate(d3.interpolateHcl)
.range([d3.rgb("#fee8c8"), d3.rgb('#e34a33')]);

export const chooseColor = function(country) {
    let result;
    if (country["aid-given"]) {
        console.log(country["aid-given"][2006]);
        result = scaleColor(country["aid-given"][2006]);
    }
    return result;
};

export const colorInNeed = function(country) {
    let result;
    if (country["aid-received"]) {
        console.log(country["aid-received"]);
        result = scaleInNeed(country["aid-received"]);
    }
    return result;
};

export function countTexture(country) {
    let color;
    if (country["aid-given"]) {
        color = chooseColor(country);
    } else if (country["aid-received"]) {
        color = colorInNeed(country);
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
var segments = 155;
export function addMaps(group, countries, aidType) {
    let totalCountries = 0;
    let countryCount = 0;

    for (const country of countries) {
        if (country[aidType]) {
          totalCountries++;
        }
    }

    for (const country of countries) {
        if (country[aidType]) {
            countryCount += 1;
            let worldTexture = countTexture(country);
            let mapMaterial = new THREE.MeshPhongMaterial({
                map: worldTexture,
                transparent: true
            });
            var baseMap = new THREE.Mesh(new THREE.SphereGeometry(200, segments, segments), mapMaterial);
            baseMap.rotation.y = Math.PI;
            group.add(baseMap);
            d3.select("#loadBarFilling")[0][0].style.width = `${(50/totalCountries*countryCount)}rem`
        }
    }
    return group
}
