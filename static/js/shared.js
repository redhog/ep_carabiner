function defineShared(_, async) {
  return function (exports) {
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

      exports.loadModule(path, function (fn) {
        functionName = functionName ? functionName : hookName;

        _.each(functionName.split("."), function (name) {
          fn = fn[name];
        });
        cb(null, fn);
      });
    };

    exports.extractHooks = function(parts, hook_set_name, cb) {
      var hooks = {};

      async.eachSeries(parts, function (part, cb) {
        if (part[hook_set_name] == undefined) {
          cb(null);
        } else {
          async.each(Object.keys(part[hook_set_name]), function (hook_name, cb) {
            if (hooks[hook_name] === undefined) hooks[hook_name] = [];

            var hook_fn_name = part[hook_set_name][hook_name];

            exports.loadFn(hook_fn_name, hook_name, function (err, hook_fn) {
              if (hook_fn) {
                hooks[hook_name].push({"hook_name": hook_name, "hook_fn": hook_fn, "hook_fn_name": hook_fn_name, "part": part});
              } else {
                console.error("Failed to load '" + hook_fn_name + "' for '" + part.full_name + "/" + hook_set_name + "/" + hook_name + ":" + err.toString());
              }
              cb(err);
            });
          }, cb);
        }
      }, function (err) {
        cb(err, hooks);
      });
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
            res.push(indent + hook.hook_name + " -> " + hook.hook_fn_name + " from " + hook.part.full_name);
          } else if (format == 'html') {
            res.push("<dt>" + indent + hook.hook_name + "</dt><dd>" + hook.hook_fn_name + " from " + hook.part.full_name + "</dd>");
          }
        });
      });
      if (format == 'text') {
       return res.join("\n");
      } else if (format == 'html') {
        return "<dl>" + res.join("\n") + "</dl>";
      }
    };
  };
};

if (typeof(define) != 'undefined' && define.amd != undefined && typeof(exports) == 'undefined') {
  define(["underscore", "async"], defineShared);
} else {
  module.exports = defineShared(require("underscore"), require("async"));
}
