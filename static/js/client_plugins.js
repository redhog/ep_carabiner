define(["jquery", "underscore", 'async', './shared', "ep_carabiner/static/js/hooks"], function ($, _, async, shared, hooks) {
  var exports = {};

  shared(exports);
  hooks.plugins = exports;

  exports.loaded = false;
  exports.plugins = {};
  exports.parts = [];
  exports.hooks = {};
  exports.baseURL = '/';

  exports.reload = function (cb) {
    // It appears that this response (see #620) may interrupt the current thread
    // of execution on Firefox. This schedules the response in the run-loop,
    // which appears to fix the issue.
    var callback = function () {setTimeout(cb, 0);};

    $.getJSON(exports.baseURL + 'plugin-definitions.json', function(data) {
      exports.plugins = data.plugins;
      exports.parts = data.parts;
        
      exports.hooks = exports.extractHooks(exports.parts, "client_hooks");
      exports.loadHooks(exports.hooks, function (err) {
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

  exports.callPageLoaded = function (cb) {
    var pageNameParts = window.location.pathname.slice(1).replace(/_/g, "/").split("/").map(function (x) {return x.slice(0, 1).toUpperCase() + x.slice(1); });

    var prefixes = [];
    for (var i = pageNameParts.length; i >= 0; i--) {
      prefixes.push(pageNameParts.slice(0, i).join(""));
    }

    var pageState = {};
    async.eachSeries(prefixes, function (prefix, cb) {
      console.log("Running " + 'documentReady' + prefix);
      hooks.aCallAll('documentReady' + prefix, pageState, cb);
    }, cb);
  }

  return exports;
});
