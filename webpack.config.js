// Include the contents of some package
const HTMLWebpackPlugin = require('html-webpack-plugin');

// Configure it
const HTMLWebpackPluginConfig = new HTMLWebpackPlugin({
  template: __dirname + "/app/template.html",
  filename: "index.html",
  inject: "body"
});

// Include it as a plugin

module.exports = {
  devtool: "sourcemap",
  entry: [
    './app/main.js'
  ],
  output: {
    path: __dirname + "/assets/",
    filename: 'app_bundle.js',
    publicPath: "../assets/"
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      }
    ]
  },
  plugins: [
    HTMLWebpackPluginConfig
  ]
};
