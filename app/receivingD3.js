const d3 = require("d3");
// Set the dimensions and padding of the canvas / graph
// var paddingDonate = [ 20, 10, 50, 100 ];
export const margin = {top: 20, right: 20, bottom: 20, left: 50},
      width = window.innerWidth * 0.22,
      height = window.innerHeight * 0.38;

  // Parse the date / time
export const parseDate = d3.time.format("%Y").parse;

  // Set the ranges
export const x = d3.time.scale().range([0, width]);
export const y = d3.scale.linear().range([height, 0]);

  // Define the axes
export const xAxisReceive = d3.svg.axis().scale(x)
      .orient("bottom").ticks(10).tickSize(0);

export const yAxisReceive = d3.svg.axis().scale(y)
      .orient("left").ticks(5);

  // Set the area graph
export const areaReceive = d3.svg.area()
  .x(function(d) {
    return x(d.year);
  })
  .y0(height - margin.bottom + 20)
  .y1(function(d) {
    return y(d.aid / 1000000);
  });
  // Adds the svg canvas
export const svgRecieve = d3.select("#d3stuff")
      .append("svg")
      .attr("id", "recieverSvg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

  // Function recieves country and data
  // returns two array being years and aid given/received
export function countryYearsAndAid(country, dataType, aidingType) {
    const res = dataType.filter((d) => d[aidingType] === country);
    const money = Object.values(res[0]).map((d) => +d || 1);
    const years = Object.keys(res[0]).map((d) => parseDate(d));
    const yearsComp = years.splice(0, years.length - 1)
    return [yearsComp, _.compact(money)];
  }

  // Get the two arrays
export function findLineInfo(country, data, aidType) {
      const [years, aid] = countryYearsAndAid(country, data, aidType);

      const countryData = years.map((year, i) => {
          let item = {
              year,
              aid: aid[i]
          }
          return item;
      });
      return countryData
  }

export function changeCountryLine(country, data, aidType) {
      const thisData = findLineInfo(country, data, aidType);
      y.domain([0, d3.max(thisData, function(d) { return d.aid / 1000000; })]);
      yAxisReceive.scale(y)
      var path = d3.selectAll("#recieverSvg path")
          .data([thisData])
          .attr("fill", "rgba(50, 195, 182, 0)")
          .attr("stroke", "black")
          .attr("d", (d) => areaReceive(d))

      const pathReceive = path.node().getTotalLength();
      path.attr("stroke-dasharray", pathReceive + " " + pathReceive)
        .attr("stroke-dashoffset", pathReceive)
        .transition().duration(300)
        .ease("linear")
        .attr("stroke-dashoffset", 0)
        .transition().duration(200)
        .attr("fill", (d, i) => "rgba(50, 195, 182, 1)" )
        .attr("stroke", "rgba(50, 195, 182, 1)");
      svgRecieve.selectAll("g.y.axis").remove();
      svgRecieve.append("g").attr("class", "y axis").call(yAxisReceive);
  }
