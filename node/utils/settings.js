var hooks = require("ep_carabiner/static/js/hooks");
var path = require("path");
var npm = require("npm/lib/npm.js");

var settings = {
  ip: '0.0.0.0',
  port: 4711,
  name: 'Carabiner',
  root: path.normalize(path.join(npm.dir, ".."))
};

var initialized = false;

exports.getSettings = function () {
  if (!initialized) {
    hooks.callAll("settings", {}).map(function (s) {
      for (var key in s) {
        settings[key] = s[key];
      }
    });

    initialized = true;
  }

  return settings;
}
