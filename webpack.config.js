const path = require("path");

// Include the contents of some package
// const HTMLWebpackPlugin = require('html-webpack-plugin');
// // Configure it
// const HTMLWebpackPluginConfig = new HTMLWebpackPlugin({
//   template: __dirname + "/app/template.html",
//   filename: "index.html",
//   inject: "body"
// });
// Include it as a plugin

module.exports = {
  entry: [
    './app/main.js'
  ],
  output: {
    path: path.join(__dirname, "dist"),
    // publicPath: __dirname + "/data/",
    filename: 'app_bundle.js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      }
    ]
  }
  // ,
  // plugins: [
  //   HTMLWebpackPluginConfig
  // ]
};
