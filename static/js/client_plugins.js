define(["jquery", "underscore", './shared'], function ($, _, shared) {
  var exports = {};

  shared(exports);

  exports.loaded = false;
  exports.plugins = {};
  exports.parts = [];
  exports.hooks = {};
  exports.baseURL = '/';

  exports.loadModule = function(path, cb) {
    require([path], cb);
  }

  exports.reload = function (cb) {
    // It appears that this response (see #620) may interrupt the current thread
    // of execution on Firefox. This schedules the response in the run-loop,
    // which appears to fix the issue.
    var callback = function () {setTimeout(cb, 0);};

    $.getJSON(exports.baseURL + 'plugin-definitions.json', function(data) {
      exports.plugins = data.plugins;
      exports.parts = data.parts;
      exports.extractHooks(exports.parts, "client_hooks", function (err, hooks) {
        exports.hooks = hooks;
        exports.loaded = true;
        callback();
      });
     }).error(function(xhr, s, err){
       console.error("Failed to load plugin-definitions: " + err);
       callback();
     });
  };

  exports.adoptPlugins = function(plugins) {
    var keys = [
        'loaded', 'plugins', 'parts', 'hooks', 'baseURL', 'ensure', 'update'];

    for (var i = 0, ii = keys.length; i < ii; i++) {
      var key = keys[i];
      exports[key] = plugins[key];
    }
  }

  exports.adoptPluginsFromAncestorsOf = function(frame, cb) {
    // Bind plugins with parent;
    var parentRequire = null;
    try {
      while (frame = frame.parent) {
        if (typeof (frame.require) !== "undefined") {
          parentRequire = frame.require;
          break;
        }
      }
    } catch (error) {
      // Silence (this can only be a XDomain issue).
    }
    if (parentRequire) {
      parentRequire(["ep_carabiner/static/js/client_plugins"], function (ancestorPlugins) {
        exports.adoptPlugins(ancestorPlugins);
        cb();
      });
    } else {
      throw new Error("Parent plugins could not be found.")
    }
  }

  return exports;
});
