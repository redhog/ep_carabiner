var npm = require("npm/lib/npm.js");
var readInstalled = require("./read-installed.js");
var path = require("path");
var async = require("async");
var fs = require("fs");
var tsort = require("./tsort");
var _ = require("underscore");
var requirejs = require('requirejs');
var shared = require("ep_carabiner/static/js/shared");
shared(exports);
var hooks = require("ep_carabiner/static/js/hooks");
hooks.plugins = exports;


exports.prefix = 'ep_';
exports.loaded = false;
exports.plugins = {};
exports.parts = [];
exports.hooks = {};

exports.reload = function (cb) {
  npm.load({}, function(er) {
    exports.getPackages(function (er, packages) {
      requirejs.config({
        packages: Object.keys(packages).map(function (name) {
            return {
              name: name,
              location: packages[name].realPath
            }
        }),
        // nodeRequire gives us the ability to access node.js native
        // require syntax from within requirejs, to do this use the syntax
        // var fs = requirejs.nodeRequire("fs");
        nodeRequire: require
      });
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

exports.loadModule = function(path, cb) {
  if (path == 'ep_carabiner/static/js/plugins') {
    cb(exports);
  } else {
    hooks.aCallFirst("loadModule", {path: path}, function (err, res) {
      if (err) {
        console.warn("Error loading module: " + path + "\n" + err.toString());
      } else {
        cb(res[0]);
      }
    })
  }
};

exports.loadNodeModule = function(hook_name, args, cb) {
  var mod = [];
  try {
    mod = [require(args.path)];
  } catch (e) {
    console.warn("Error loading CommonJS module: " + args.path + "\n" + e.toString());
  }
  cb(mod);
};

exports.loadRequireJSModule = function(hook_name, args, cb) {
  requirejs([args.path], function (mod) {
    cb([mod]);
  });
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

  exports.getPackages(function (er, packages) {
    var parts = [];
    var plugins = {};
    // Load plugin metadata ep.json
    async.forEach(
      Object.keys(packages),
      function (plugin_name, cb) {
        loadPlugin(packages, plugin_name, plugins, parts, cb);
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


exports.getPackages = function (cb) {
  // Load list of installed NPM packages, flatten it to a list, and filter out only packages with names that
  var dir = path.resolve(npm.dir, '..');
  readInstalled(dir, function (er, data) {
    if (er) cb(er, null);
    var packages = {};
    function flatten(deps) {
      _.chain(deps).keys().each(function (name) {
        if (name.indexOf(exports.prefix) === 0) {
          packages[name] = _.clone(deps[name]);
          // Delete anything that creates loops so that the plugin
          // list can be sent as JSON to the web client
          delete packages[name].dependencies;
          delete packages[name].parent;
        }
      
        if (deps[name].dependencies !== undefined) flatten(deps[name].dependencies);
      });
    }
  
    var tmp = {};
    tmp[data.name] = data;
    flatten(tmp);
    cb(null, packages);
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
