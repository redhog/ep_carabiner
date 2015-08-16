var npm = require("npm/lib/npm.js");
var readInstalled = require("./read-installed.js");
var path = require("path");
var async = require("async");
var fs = require("fs");
var tsort = require("./tsort");
var _ = require("underscore");
var shared = require("ep_carabiner/static/js/shared");
shared(exports);
var hooks = require("ep_carabiner/static/js/hooks");
hooks.plugins = exports;


exports.prefix = 'ep_';
exports.loaded = false;
exports.packages = {};
exports.plugin_packages = {};
exports.plugins = {};
exports.parts = [];
exports.hooks = {};

exports.reload = function (cb) {
  npm.load({}, function(er) {
    exports.loadPluginPackages(function (er) {
      exports.update(cb);
    });
  });
};

exports.callInit = function (cb) {
  async.mapSeries(
    Object.keys(exports.plugins),
    function (plugin_name, cb) {
      var plugin = exports.plugins[plugin_name];
      fs.stat(path.normalize(path.join(plugin.package.path, ".ep_initialized")), function (err, stats) {
        if (err) {
          async.waterfall([
            function (cb) { fs.writeFile(path.normalize(path.join(plugin.package.path, ".ep_initialized")), 'done', cb); },
            function (cb) { hooks.aCallAll("init_" + plugin_name, {}, cb); },
            cb,
          ]);
        } else {
          cb();
        }
      });
    },
    function () { cb(); }
  );
}

exports.update = function (cb) {
  exports.loadPlugins(function () {
    exports.loadHooks(exports.hooks, function (err) {
      exports.loadHooks(exports.client_hooks, function (err) {
        exports.loaded = true;
        exports.callInit(cb);
      });
    });
  });
};

exports.loadPlugins = function (cb) {
  var partsToParentChildList = function(parts) {
    var res = [];
    _.chain(parts).keys().forEach(function (name) {
      _.each(parts[name].post || [], function (child_name)  {
        res.push([name, child_name]);
      });
      _.each(parts[name].pre || [], function (parent_name)  {
        res.push([parent_name, name]);
      });
      if (!parts[name].pre && !parts[name].post) {
        res.push([name, ":" + name]); // Include apps with no dependency info
      }
    });
    return res;
  }

  var sortParts = function(parts) {
    return tsort(
      partsToParentChildList(parts)
    ).filter(
      function (name) { return parts[name] !== undefined; }
    ).map(
      function (name) { return parts[name]; }
    );
  }

  exports.loadPluginPackages(function (er) {
    var parts = [];
    var plugins = {};
    // Load plugin metadata ep.json
    async.forEach(
      Object.keys(exports.plugin_packages),
      function (plugin_name, cb) {
        loadPlugin(exports.plugin_packages, plugin_name, plugins, parts, cb);
      },
      function (err) {
        if (err) cb(err);
        exports.plugins = plugins;
        exports.parts = sortParts(parts);
        exports.hooks = exports.extractHooks(exports.parts, "hooks");
        // Extract client side hooks here too, so we don't have to call it from formatHooks (which is synchronous)
        exports.client_hooks = exports.extractHooks(exports.parts, "client_hooks");

        cb();
      }
    );
  });
};

exports.loadPluginPackages = function (cb) {
  // Filters the result of getPackages() to only packages with the right prefix
  exports.loadPackages(function (err) {
    if (err) {
      cb(err);
    } else {
      var res = {};
      for (var name in exports.packages) {
        if (name.indexOf(exports.prefix) === 0) {
          res[name] = exports.packages[name];
        }
      }
      exports.plugin_packages = res;
      cb(null);
    }
  });
}

exports.loadPackages = function (cb) {
  // Loads a list of installed NPM packages and flattens them to a list
  var dir = path.resolve(npm.dir, '..');
  readInstalled(dir, function (er, data) {
    if (er) cb(er, null);
    var packages = {};
    function flatten(deps) {
      _.chain(deps).keys().each(function (name) {
        packages[name] = _.clone(deps[name]);
        // Delete anything that creates loops so that the plugin
        // list can be sent as JSON to the web client
        delete packages[name].dependencies;
        delete packages[name].parent;      
        if (deps[name].dependencies !== undefined) flatten(deps[name].dependencies);
      });
    }
  
    var tmp = {};
    tmp[data.name] = data;
    flatten(tmp);
    exports.packages = packages;
    cb();
  });
};

function loadPlugin(packages, plugin_name, plugins, parts, cb) {
  var plugin_path = path.resolve(packages[plugin_name].path, "ep.json");
  fs.readFile(
    plugin_path,
    function (er, data) {
      if (er) {
        console.error("Unable to load plugin definition file " + plugin_path);
        return cb();
      }
      try {
        var plugin = JSON.parse(data);
        plugin['package'] = packages[plugin_name];
        plugins[plugin_name] = plugin;
        _.each(plugin.parts, function (part) {
          part.plugin = plugin_name;
          part.full_name = plugin_name + "/" + part.name;
          parts[part.full_name] = part;
        });
      } catch (ex) {
        console.error("Unable to parse plugin definition file " + plugin_path + ": " + ex.toString());
      }
      cb();
    }
  );
}
