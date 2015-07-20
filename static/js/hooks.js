function defineHooks(_, async, exports) {
  if (exports == undefined) exports = {};

  exports.bubbleExceptions = true

  // Normalize hook output to a list
  var normalizeToList = function(x) {
    if (x === undefined) return [];
    return x;
  }

  var handleExceptions = function(fn, description) {
    if (exports.bubbleExceptions) {
      return fn();
    } else {
      try {
        return fn();
      } catch (ex) {
        console.error(description + ": " + (ex.stack || ex).toString());
      }
    }
  }

  var hookCallWrapper = function (hook, hook_name, args) {
    if (!hook.hook_fn) {
      return [];
    }

    handleExceptions(function () {
      return normalizeToList(hook.hook_fn(hook_name, args));
    }, hook_name + " from " + hook.part_full_name);
  }

  var aHookCallWrapper = function (hook, hook_name, args, cb) {
    if (!hook.hook_fn) {
      if (hook.error) {
        cb([]);
      } else {
        console.log("During call to " + hook_name + ": Having to load " + hook.hook_fn_name + "...");
        exports.plugins.loadHook(hook, function () {
          aHookCallWrapper(hook, hook_name, args, cb);
        });
      }
      return;
    }

    handleExceptions(function () {
      hook.hook_fn(hook_name, args, function (x) {
        cb(normalizeToList(x));
      });
    }, hook_name + " from " + hook.part_full_name);
  }

  exports.syncMapFirst = function (lst, fn) {
    var i;
    var result;
    for (i = 0; i < lst.length; i++) {
      result = fn(lst[i])
      if (result.length) return result;
    }
    return undefined;
  }

  exports.mapFirst = function (lst, fn, cb) {
    var i = 0;

    var next = function () {
      if (i >= lst.length) return cb(undefined);
      fn(lst[i++], function (err, result) {
        if (err) return cb(err);
        if (result.length) return cb(null, result);
        next();
      });
    }
    next();
  }


  /* Don't use Array.concat as it flatterns arrays within the array */
  exports.flatten = function (lst) {
    var res = [];
    if (lst != undefined && lst != null) {
      for (var i = 0; i < lst.length; i++) {
        if (lst[i] != undefined && lst[i] != null) {
          for (var j = 0; j < lst[i].length; j++) {
            res.push(lst[i][j]);
      }
        }
      }
    }
    return res;
  }

  exports.callAll = function (hook_name, args) {
    if (!args) args = {};
    if (exports.plugins === undefined || exports.plugins.hooks[hook_name] === undefined) return [];
    return _.flatten(_.map(exports.plugins.hooks[hook_name], function (hook) {
      return hookCallWrapper(hook, hook_name, args);
    }), true);
  }

  exports.aCallAll = function (hook_name, args, cb) {
    if (!args) args = {};
    if (!cb) cb = function () {};
    if (exports.plugins === undefined || exports.plugins.hooks[hook_name] === undefined) return cb(null, []);
    async.mapSeries(
      exports.plugins.hooks[hook_name],
      function (hook, cb) {
        aHookCallWrapper(hook, hook_name, args, function (res) { cb(null, res); });
      },
      function (err, res) {
        cb(null, _.flatten(res, true));
      }
    );
  }

  exports.callFirst = function (hook_name, args) {
    if (!args) args = {};
    if (exports.plugins === undefined || exports.plugins.hooks[hook_name] === undefined) return [];
    return exports.syncMapFirst(exports.plugins.hooks[hook_name], function (hook) {
      return hookCallWrapper(hook, hook_name, args);
    });
  }

  exports.aCallFirst = function (hook_name, args, cb) {
    if (!args) args = {};
    if (!cb) cb = function () {};
    if (exports.plugins === undefined || exports.plugins.hooks[hook_name] === undefined) return cb(null, []);
    exports.mapFirst(
      exports.plugins.hooks[hook_name],
      function (hook, cb) {
        aHookCallWrapper(hook, hook_name, args, function (res) { cb(null, res); });
      },
      cb
    );
  }

  exports.callAllStr = function(hook_name, args, sep, pre, post) {
    if (sep == undefined) sep = '';
    if (pre == undefined) pre = '';
    if (post == undefined) post = '';
    var newCallhooks = [];
    var callhooks = exports.callAll(hook_name, args);
    for (var i = 0, ii = callhooks.length; i < ii; i++) {
      newCallhooks[i] = pre + callhooks[i] + post;
    }
    return newCallhooks.join(sep || "");
  }

  return exports;
}


if (typeof(define) != 'undefined' && define.amd != undefined && typeof(exports) == 'undefined') {
  define(["underscore", "async"], defineHooks);
} else {       
  defineHooks(require("underscore"), require("async"), exports);
}
