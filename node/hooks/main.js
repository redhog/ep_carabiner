define([], function () {
  return {
    start: function(hook_name, args, cb) {
      console.log(["STARTUP", args]);
      cb();
    }
  };
});

