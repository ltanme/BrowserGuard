const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  target: 'electron-renderer',
  devServer: {
    static: {
      directory: path.join(__dirname, 'src/renderer'),
    },
    port: 8080,
    open: true,
    hot: true,
    historyApiFallback: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      global: 'window'
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/renderer/index.html'),
          to: path.resolve(__dirname, 'dist/renderer/index.html')
        }
      ]
    })
  ],
}; 