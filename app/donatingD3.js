const d3 = require("d3");
//Set up stack method
export const stack = d3.layout.stack()
        .values(function(d) {
          return d.aid;
        })
        .order("reverse");

//Width, height, padding
export const w = 700;
export const h = 400;
export const padding = [ 20, 10, 50, 100 ];  //Top, right, bottom, left

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

//Easy colors accessible via a 10-step ordinal scale
export const colorDonate = d3.scale.category10();

//Create the SVG
export const svgDonate = d3.select("body")
      .append("svg")
      .attr("id", "donaterSvg")
      .attr("width", w)
      .attr("height", h);

export function findStackedData(country, ...allData) {
  // Get all the data for a country and store in an array
  const countryData = [];
  allData.forEach((indArray) => {
    countryData.push( indArray.filter((item) => {
      return Object.values(item)[Object.values(item).length - 1] === country
    })[0] );
  });
  // Setup the returned data-structure
  const dataResult = [{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] },{ aid: [] }]
  // iterate over the countries data
  countryData.forEach((item, i) => {
    // Get the values and keys arrays of each
    const years = Object.keys(item)
    const money = Object.values(item)
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
