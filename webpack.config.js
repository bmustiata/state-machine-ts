var webpack = require('webpack');
var SmartBannerPlugin = require('smart-banner-webpack-plugin');
var fs = require("fs");
var localNodeModules = fs.readdirSync("node_modules");

localNodeModules.splice(0, 0, "fs", "net", "path")

module.exports = {
  entry: ['babel-polyfill', './src/main.ts'],
  output: {
    filename: 'out/main.js',
    library: true,
    libraryTarget : 'commonjs2',
      node: {
        __filename: true,
        __dirname: true,
      },
  },
  resolve: {
      extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js']
  },
  target: "node", // don't include stubs for `process`, etc.
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: localNodeModules,
  node: {
    __filename: true,
    __dirname: true,
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      },
      {
        test: function(name) {
          if (/\.tsx?$/.test(name)) {
            return true;
          }

          if (!/\./.test(name)) {
            return true;
          }

          return false;
        },
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader?presets=es2015!ts-loader',
      }
    ]
  },
  plugins: [
    new SmartBannerPlugin(
        'require("source-map-support/register");\n',
        {raw: true, entryOnly: false }),
    new webpack.DefinePlugin({
        $dirname: '__dirname',
    }),
  ],
  devtool: 'source-map'
}

