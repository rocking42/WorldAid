// Include the contents of some package
const HTMLWebpackPlugin = require('html-webpack-plugin');

// Configure it
const HTMLWebpackPluginConfig = new HTMLWebpackPlugin({
  template: __dirname + "/app/template.html",
  filename: "index.html",
  inject: "body"
});

const webpackUglifyJsPlugin = require('webpack-uglify-js-plugin');

const webpackUglifyJSPluginConfig = new webpackUglifyJsPlugin({
  cacheFolder: __dirname + 'dist/',
  debug: true,
  minimize: true,
  sourceMap: false,
  output: {
    comments: false
  },
  compressor: {
    drop_debugger: false,
    warnings: false
  }
});

// Include it as a plugin

module.exports = {
  devtool: "sourcemap",
  entry: [
    './app/main.js'
  ],
  output: {
    path: __dirname + "/dist/",
    filename: 'app_bundle.js'
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
    HTMLWebpackPluginConfig,
    webpackUglifyJSPluginConfig
  ]
};
