#!/usr/bin/env node
/**
 * This script loads all plugins and calls the hook 'start'.
 */

/*
 * 2011 Peter 'Pita' Martischka (Primary Technology Ltd)
 * 2015 Egil Moeller <redhog@redhog.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var log4js = require('log4js')
  , async = require('async')
  ;

log4js.replaceConsole();
log4js.getLogger('carabiner').setLevel('WARN');


var settings
  , plugins
  , hooks;

async.waterfall([
  
  // load everything
  function(callback) {
    plugins = require("ep_carabiner/static/js/plugins");
    hooks = require("ep_carabiner/static/js/hooks");
    hooks.plugins = plugins;
    callback();
  },

  function(callback) {
    plugins.ensure(callback)
  },

  function (callback) {
    plugins.logConfig();
    callback();
  },

  //initalize the http server
  function (callback)
  {
    hooks.aCallAll("start", {});
    callback(null);  
  }
]);
