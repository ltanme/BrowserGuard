const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
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
}; 