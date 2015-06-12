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

var fs = require("fs");
var path = require('path');
var npm = require("npm/lib/npm.js");

// Provide git version if available
exports.getGitCommit = function() {
  var version = "";
  try
  {
    var rootPath = path.resolve(npm.dir, '..');
    var ref = fs.readFileSync(rootPath + "/.git/HEAD", "utf-8");
    var refPath = rootPath + "/.git/" + ref.substring(5, ref.indexOf("\n"));
    version = fs.readFileSync(refPath, "utf-8");
    version = version.substring(0, 7);
  }
  catch(e)
  {
    console.warn("Can't get git version for server header\n" + e.message)
  }
  return version;
}

// Return ep_express version from package.json
exports.getPackageVersion = function() {
  return require('ep_express/package.json').version;
}
