const d3 = require("d3");

const svg = d3.select("svg")
              .attr("width", window.innerWidth)
              .attr("height", window.innerHeight);

d3.csv("Data1.csv", (data) => {
  const rects = svg;
})
