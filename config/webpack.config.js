'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');

// Merge webpack configuration files
const config = (env, argv) =>
  merge(common, {
    entry: {
      options: PATHS.src + '/options.js',
      contentScript: PATHS.src + '/contentScript.js',
    },
    devtool: argv.mode === 'production' ? false : 'source-map',
  });

module.exports = config;
