function defineShared(_, async, hooks) {
  return function (exports) {
    /* Ugly hack. Remove? */
    hooks.plugins = exports;

    exports.ensure = function (cb) {
      if (!exports.loaded) {
        exports.reload(function () {
          exports.loaded = true;
          cb();
        });
      } else {
        cb();
      }
    };

    if (typeof(window) != 'undefined') {
      exports.global = window;
    } else if (typeof(global) != 'undefined') {
      exports.global = global;
    } else {
      exports.global = {}
    }

    exports.loadModule = function(path, cb) {
      if (path == '') {
        cb(null, exports.global);
      } else if (path == 'ep_carabiner/static/js/shared') {
        cb(null, exports);
      } else {
        var args = {path: path, errors: {}};
        hooks.aCallFirst("loadModule", args, function (loaderError, res) {
          if (loaderError) {
            args.errors.loaderError = loaderError;
          }
          if (!res || res.length == 0) {
            var error = {
              errors: args.errors,
              path: path,
              toString: function () {
                var self = this;
                var modules = Object.keys(self.errors);
                modules.sort();
                return ("Error loading module: " + self.path + "\n" +
                  modules.map(function(module) {
                    return "  " + module + ": " + self.errors[module] + "\n" + self.errors[module].stack;
                  }).join("\n"));
              }
            };
	    cb(error);
          } else {
            cb(null, res[0]);
          }
        })
      }
    };

    exports.loadNodeModule = function(hook_name, args, cb) {
      var mod = [];
      try {
        mod = [require(args.path)];
      } catch (error) {
        args.errors.loadNodeModule = error;
      }
      cb(mod);
    };

    exports.loadFn = function(path, hookName, cb) {
      var functionName
        , parts = path.split(":");

      // on windows: C:\foo\bar:xyz
      if (parts[0].length == 1) {
        if (parts.length == 3) {
          functionName = parts.pop();
        }
        path = parts.join(":");
      } else {
        path = parts[0];
        functionName = parts[1];
      }

      exports.loadModule(path, function (err, fn) {
        if (err) {
          cb(err);
        } else {
          functionName = functionName ? functionName : hookName;

          _.each(functionName.split("."), function (name) {
            fn = fn[name];
          });
          cb(null, fn);
        }
      });
    };

    exports.extractHooks = function(parts, hook_set_name) {
      var hooks = {};

      _.each(parts, function (part) {
        if (part[hook_set_name] != undefined) {
          for (var hook_name in part[hook_set_name]) {
            if (hooks[hook_name] === undefined) hooks[hook_name] = [];

            var hook_fn_name = part[hook_set_name][hook_name];

            hooks[hook_name].push({
              "hook_set_name": hook_set_name,
              "hook_name": hook_name,
              "hook_fn_name": hook_fn_name,
              "part_full_name": part.full_name
            });
          }
        }
      });

      return hooks;
    };

    exports.loadHook = function(hook, cb) {
      if (hook.loading) {
        cb();
      } else {
        hook.loading = true;
        exports.loadFn(hook.hook_fn_name, hook.hook_name, function (err, hook_fn) {
          if (hook_fn) {
            hook.hook_fn = hook_fn;
          } else {
	    if (!err) err = "No loader found";
            hook.error = err;
            console.error("Failed to load '" + hook.hook_fn_name + "' for '" + hook.part_full_name + "/" + hook.hook_set_name + "/" + hook.hook_name + ": " + err.toString());
          }
          hook.loading = false;
          cb();
        });
      }
    };

    exports.loadHooks = function(hooks, cb) {
      async.each(Object.keys(hooks), function (hook_name, cb) {
        async.each(hooks[hook_name], exports.loadHook.bind(exports), cb);
      },
      cb);
    };

    exports.formatPlugins = function () {
      return _.keys(exports.plugins).join(", ");
    };

    exports.formatParts = function (format, indent) {
      if (format == undefined) format = 'html';

      var parts = _.map(exports.parts, function (part) { return part.full_name; });
      if (format == 'text') {
        var parts = _.map(parts, function (part) { return indent + part; });
        return parts.join("\n");
      } else if (format == 'html') {
        var parts = _.map(parts, function (part) { return "<li>" + indent + part + "</li>"; });
        return "<ul>" + parts.join("\n") + "</ul>";
      }
    };

    exports.formatHooks = function (hook_set_name, format, indent) {
      if (format == undefined) format = 'html';
      if (indent == undefined) indent = '';

      var res = [];
      var hooks = exports[hook_set_name || "hooks"];

      _.chain(hooks).keys().forEach(function (hook_name) {
        _.forEach(hooks[hook_name], function (hook) {
          if (format == 'text') {
            res.push(indent + hook.hook_name + " -> " + hook.hook_fn_name + " from " + hook.part_full_name);
          } else if (format == 'html') {
            res.push("<dt>" + indent + hook.hook_name + "</dt><dd>" + hook.hook_fn_name + " from " + hook.part_full_name + "</dd>");
          }
        });
      });
      if (format == 'text') {
       return res.join("\n");
      } else if (format == 'html') {
        return "<dl>" + res.join("\n") + "</dl>";
      }
    };

    exports.logConfig = function () {
      console.info("Installed plugins:\n  " + exports.formatPlugins());
      console.debug("Installed parts:\n" + exports.formatParts('text', '  '));
      console.debug("Installed hooks:\n" + exports.formatHooks('hooks', 'text', '  '));
      console.debug("Installed client hooks:\n" + exports.formatHooks('client_hooks', 'text', '  '));
    }
  };
};

if (typeof(define) != 'undefined' && define.amd != undefined && typeof(exports) == 'undefined') {
    define(["underscore", "async", 'ep_carabiner/static/js/hooks'], defineShared);
} else {
    module.exports = defineShared(require("underscore"), require("async"), require('ep_carabiner/static/js/hooks'));
}
