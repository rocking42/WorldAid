const d3 = require("d3");
const values = require('object.values');
//Set up stack method
export const stack = d3.layout.stack()
        .values(function(d) {
          return d.aid;
        })
        .order("reverse");

//Width, height, padding
export const w = window.innerWidth * 0.38;
export const h = window.innerHeight * 0.47;
export const padding = [ 20, 10, 50, 110 ];  //Top, right, bottom, left

//Set up date format function (years)
export const dateFormat = d3.time.format("%Y");

//Define scales with ranges (domains will be set later)
export const xScaleDonate = d3.time.scale()
          .range([ padding[3], w - padding[1] - padding[3] ]);

export const yScaleDonate = d3.scale.linear()
           //.range([ 0, h ]);
          .range([ padding[0], h - padding[2] ]);

//Define axes
export const xAxisDonate = d3.svg.axis()
        .scale(xScaleDonate)
        .orient("bottom")
        .ticks(10)
        .tickFormat(function(d) {
          return dateFormat(d);
        });

export const yAxisDonate = d3.svg.axis()
        .scale(yScaleDonate)
        .orient("left")
        .ticks(5);

//Define area generator
export const areaDonate = d3.svg.area()
  .interpolate("basis")
  .x(function(d) {
    return xScaleDonate(dateFormat.parse(d.x));  //Updated
  })
  .y0(function(d) {
    return yScaleDonate(d.y0);  //Updated
  })
  .y1(function(d) {
    return yScaleDonate(d.y0 + d.y);  //Updated
  });

export const domain = ["crossSectorAid", "economicalInfastructure", "educationalAid", "govAndCivil", "healthAid", "populationPoliciesAid", "productionSectorAid", "socialServicesAid", "waterAndSanitationAid"];
export const colorScheme = ["#3e6ab2", "#528ff2", "#a7c3f2", "#e6eaf2", "#f78604", "#f2b46d", "#e8c9a7", "#a7e8ce", "#42e5a4"];

export const colorDescription = ["Cross Sector Aid", "Economical Infastructure", "Educational Aid", "Gov And Civil", "Health Aid", "Population Policies Aid", "Production Sector Aid", "Social Services Aid", "Water And Sanitation Aid"];

//Easy colors accessible via a 10-step ordinal scale
export const colorDonate = d3.scale.ordinal()
                                   .domain(domain)
                                   .range(colorScheme);
//Create the SVG
export const svgDonate = d3.select("#d3stuff")
      .append("svg")
      .attr("id", "donaterSvg")
      .attr("width", w)
      .attr("height", h);

export function findStackedData(country, ...allData) {
  // Get all the data for a country and store in an array
  const countryData = [];
  allData.forEach((indArray) => {
    countryData.push( indArray.filter((item) => {
      return values(item)[values(item).length - 1] === country
    })[0] );
  });
  // Setup the returned data-structure
  const dataResult = [{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] }]
  // iterate over the countries data
  countryData.forEach((item, i) => {
    // Get the values and keys arrays of each
    const years = Object.keys(item)
    const money = values(item)
    // Set the name of the aid-type
    dataResult[i]["aidType"] = years[years.length - 1];
    // Zip the arrays together
    const yearsMoney = _.zip(years, money);
    // iterate over the joined array and push the first and second value
    yearsMoney.forEach((miniArray, y) => {
      // Don't add the last value
      if (!(yearsMoney.length - 1 === y)) {
        dataResult[i]["aid"].push(
          {x: miniArray[0], y: +miniArray[1] || 1}
        )
      }
    })
  });
  return stack(dataResult);
}


export function displayNewStack(country, ...dataSources) {
    const dataset2 = findStackedData(country, ...dataSources);

    var path = d3.selectAll("#donaterSvg path").data(dataset2)
                        .attr("stroke", (d, i) => colorDonate(i))
                        .attr("fill", "#fff")
                        .attr("d", (d) => areaDonate(d.aid) )

    const pathLength = path.node().getTotalLength();
    path.attr("stroke-dasharray", pathLength + " " + pathLength)
        .attr("stroke-dashoffset", pathLength)
        .transition().duration(300)
        .ease("linear")
        .attr("stroke-dashoffset", 0)
        .transition().duration(200)
        .attr("fill", (d, i) => colorDonate(i) )
}
