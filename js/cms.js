"use strict";
/* jshint ignore:start */

/* jshint ignore:end */

define('cms/app', ['exports', 'ember', 'ember/resolver', 'ember/load-initializers', 'cms/config/environment'], function (exports, Ember, Resolver, loadInitializers, config) {

  'use strict';

  Ember['default'].MODEL_FACTORY_INJECTIONS = true;

  var App = Ember['default'].Application.extend({
    modulePrefix: config['default'].modulePrefix,
    podModulePrefix: config['default'].podModulePrefix,
    Resolver: Resolver['default']
  });

  loadInitializers['default'](App, config['default'].modulePrefix);

  /**
    The global CMS object exposing methods for extending and configuring the CMS.

    @class CMS
    @static
  */
  window.CMS = {};

  /**
    Add a custom widget control.

    Takes the name of the widget and an object defining the behavior of the control.

    Each widget control is an Ember.Component, and can be paired with a handlebars template.

    From within the component you have access to the `widget` model.

    ## Usage:

    This defines a simple control that will toggle the widget value between true and false.

    ```javascript
    CMS.WidgetControl("foo", {
      actions: {
        toggle: function() {
          this.set("widget.value", this.get("widget.value") ? false : true);
        }
      }
    });
    ```

    To pair the widget control with a template, create a template in "cms/widgets/":

    ```html
    <script type="text/x-handlebars" data-template-name="cms/widgets/foo-control">
      <h2>{{widget.label}}</h2>
      <button class="button" {{action 'toggle'}}>Toogle Foo</button>
    </script>
    ```

    @method WidgetControl
    @param {String} name
    @param {Object} widget
  */
  window.CMS.WidgetControl = function (name, widget) {
    define('cms/components/cms/widgets/' + name + '-control', ['exports'], function (exports) {
      exports['default'] = Ember['default'].Component.extend(widget);
    });
  };

  /**
    Add a custom widget preview.

    Takes the name of the widget and an object defining the behavior of the preview.

    Each widget preview is an Ember.Component, and can be paired with a handlebars template.

    From within the component you have access to the `widget` model.

    ## Usage:

    This defines a simple preview component that'll reverse the string value of the
    widget by using one of Ember's computed properties.

    ```javascript
    CMS.WidgetPreview("foo", {
      reverseValue: function() {
        var value = this.get("widget.value") || "";
        var reversed = value.split("").reverse().join("");
        this.set("widget.reversed", reversed);
      }.observes("widget.value")
    });
    ```

    To pair the widget preview with a template, create a template in "cms/widgets/":

    ```html
    <script type="text/x-handlebars" data-template-name="cms/widgets/foo-preview">
      <h2>{{widget.reversed}}</h2>
    </script>
    ```

    @method WidgetPreview
    @param {String} name
    @param {Object} widget
  */
  window.CMS.WidgetPreview = function (name, widget) {
    define('cms/components/cms/widgets/' + name + '-preview', ['exports'], function (exports) {
      exports['default'] = Ember['default'].Component.extend(widget);
    });
  };

  /**
    Define a custom Format for reading and saving files.

    Each format needs to define `fromFile` and `toFile` methods and set an `extension` property..

    ## Usage

    ```javascript
    CMS.Format("txt", {
      extension: "txt",
      fromFile: function(content) {
        return {
          title: content.split("\n")[0],
          body: content
        };
      },
      toFile: function(obj) {
        return obj.body;
      }
    });
    ```

    @method Format
    @param {String} name
    @param {Object} format
  */
  window.CMS.Format = function (name, format) {
    define('cms/formats/' + name, ['exports'], function (exports) {
      exports['default'] = Ember['default'].Object.extend(format);
    });
  };

  window.CMS.Backend = function (name, backend) {
    define('cms/backends' + name, ['exports'], function (exports) {
      exports['default'] = Ember['default'].Object.extend(backend);
    });
  };

  exports['default'] = App;

});
define('cms/backends/github_api', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var Promise = Ember['default'].RSVP.Promise;
  var ENDPOINT = "https://api.github.com/";

  /**
   Github API repository backend.

   ```yaml
   backend:
     name: github_api
     repo: netlify/netlify-home
     branch: master
   ```

   This backend uses the Git Data API to create commits when updateFiles is called.

   @class GithubAPI
   */
  exports['default'] = Ember['default'].Object.extend({
    /**
      Sets up a new Github API backend
       The config requires a `repo` and a `branch`.
       @method constructor
      @param {Config} config
      @return {GithubAPI} github_backend
    */
    init: function init() {
      var config = this.get("config");
      this.base = ENDPOINT + "repos/" + (config && config.backend.repo);
      this.branch = config && config.backend.branch || "master";
      this.config = config;
    },

    /**
      Authorize a user via a github_access_token.
       @method authorize
      @param {Object} credentials
      @return {Promise} result
    */
    authorize: function authorize(credentials) {
      var _this = this;

      this.token = credentials.github_access_token;
      return new Promise(function (resolve, reject) {
        _this.request(_this.base).then(function (repo) {
          if (repo.permissions.push && repo.permissions.pull) {
            resolve();
          } else {
            reject("This user doesn't have write access to the repo '" + _this.config.repo + "'");
          }
        }, function (err) {
          console.log("Auth error: %o", err);
          reject("This user couldn't access the repo '" + _this.config.repo + "'");
        });
      });
    },

    /**
      Read the content of a file in the repository
       @method readFile
      @param {String} path
      @return {String} content
    */
    readFile: function readFile(path) {
      return this.request(this.base + "/contents/" + path, {
        headers: { Accept: "application/vnd.github.VERSION.raw" },
        data: { ref: this.branch },
        cache: false
      });
    },

    /**
      Get a list of files in the repository
       @method listFiles
      @param {String} path
      @return {Array} files
    */
    listFiles: function listFiles(path) {
      return this.request(this.base + "/contents/" + path, {
        data: { ref: this.branch }
      });
    },

    /**
      Update files in the repo with a commit.
       A commit message can be specified in `options` as `message`.
       @method updateFiles
      @param {Array} uploads
      @param {Object} options
      @return {Promise} result
    */
    updateFiles: function updateFiles(uploads, options) {
      var _this2 = this;

      var filename, part, parts, subtree;
      var fileTree = {};
      var files = [];

      uploads.forEach(function (file) {
        if (file.uploaded) {
          return;
        }
        files.push(file.upload ? file : _this2.uploadBlob(file));
        parts = file.path.split("/").filter(function (part) {
          return part;
        });
        filename = parts.pop();
        subtree = fileTree;
        while (part = parts.shift()) {
          subtree[part] = subtree[part] || {};
          subtree = subtree[part];
        }
        subtree[filename] = file;
        file.file = true;
      });

      return Promise.all(files).then(function () {
        return _this2.getBranch();
      }).then(function (branchData) {
        return _this2.updateTree(branchData.commit.sha, "/", fileTree);
      }).then(function (changeTree) {
        return _this2.request(_this2.base + "/git/commits", {
          type: "POST",
          data: JSON.stringify({ message: options.message, tree: changeTree.sha, parents: [changeTree.parentSha] })
        });
      }).then(function (response) {
        return _this2.request(_this2.base + "/git/refs/heads/" + _this2.branch, {
          type: "PATCH",
          data: JSON.stringify({ sha: response.sha })
        });
      });
    },

    /**
      Delete a file in the repo with a commit.
       A commit message can be specified in `options` as `message`.
       @method DeleteFiles
      @param {Object} file
      @param {Object} options
      @return {Promise} result
    */
    deleteFile: function deleteFile(file, options) {
      var _this3 = this;

      var match = (file && file.path || "").match(/^(.*)\/([^\/]+)$/);
      var dir = match && match[1];
      var name = match && match[2];
      if (!name) {
        return Ember['default'].RSVP.Promise.reject("Bad file path");
      }
      return this.listFiles(dir).then(function (files) {
        for (var i = 0; i < files.length; i++) {
          var meta = files[i];
          if (meta.name === name) {
            return _this3.request(_this3.base + "/contents/" + meta.path, {
              type: "DELETE",
              data: JSON.stringify({
                message: options.message || "Deleting " + file.path,
                sha: meta.sha,
                branch: _this3.branch
              })
            });
          }
        }
      });
    },

    request: function request(url, settings) {
      return Ember['default'].RSVP.Promise.cast(Ember['default'].$.ajax(url, Ember['default'].$.extend(true, {
        headers: { Authorization: "Bearer " + this.token },
        contentType: "application/json"
      }, settings || {})));
    },

    getBranch: function getBranch() {
      return this.request(this.base + "/branches/" + this.branch, { cache: false });
    },

    getTree: function getTree(sha) {
      return sha ? this.request(this.base + "/git/trees/" + sha) : Promise.resolve({ tree: [] });
    },

    uploadBlob: function uploadBlob(file) {
      return this.request(this.base + "/git/blobs", {
        type: "POST",
        data: JSON.stringify({
          content: file.base64 ? file.base64() : Base64.encode(file.content),
          encoding: "base64"
        })
      }).then(function (response) {
        file.sha = response.sha;
        file.uploaded = true;
        return file;
      });
    },

    updateTree: function updateTree(sha, path, fileTree) {
      var _this4 = this;

      return this.getTree(sha).then(function (tree) {
        var obj, filename, fileOrDir;
        var updates = [];
        var added = {};

        for (var i = 0, len = tree.tree.length; i < len; i++) {
          obj = tree.tree[i];
          if (fileOrDir = fileTree[obj.path]) {
            added[obj.path] = true;
            if (fileOrDir.file) {
              updates.push({ path: obj.path, mode: obj.mode, type: obj.type, sha: fileOrDir.sha });
            } else {
              updates.push(_this4.updateTree(obj.sha, obj.path, fileOrDir));
            }
          }
        }
        for (filename in fileTree) {
          fileOrDir = fileTree[filename];
          if (added[filename]) {
            continue;
          }
          updates.push(fileOrDir.file ? { path: filename, mode: "100644", type: "blob", sha: fileOrDir.sha } : _this4.updateTree(null, filename, fileOrDir));
        }
        return Promise.all(updates).then(function (updates) {
          return _this4.request(_this4.base + "/git/trees", {
            type: "POST",
            data: JSON.stringify({ base_tree: sha, tree: updates })
          });
        }).then(function (response) {
          return { path: path, mode: "040000", type: "tree", sha: response.sha, parentSha: sha };
        });
      });
    }
  });

});
define('cms/backends/netlify-api', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var Promise = Ember['default'].RSVP.Promise;

  /**
   NetlifyAPI repository backend.

   To use this backend, download the relevant release from [Github](https://github.com/netlify/cms-local-backend),
   make sure the binary is in your PATH and then run `netlify-local-cms` from within your website repo.

   Configure the backend in your config.yml like this:

   ```yaml
   backend:
     name: netlify_api
     url: http://localhost:8080
   ```

   @class NetlifyApi
   */
  exports['default'] = Ember['default'].Object.extend({
    init: function init() {
      this.base = this.config.backend.url;
      this.branch = this.config.backend.branch || "master";
    },

    authorize: function authorize(credentials) {
      this.set("token", credentials.access_token);
      return Promise.resolve(true);
    },

    listFiles: function listFiles(path) {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this.request(_this.base + "/files/" + path, {}).then(function (data) {
          resolve(data);
        }, function (error) {
          reject(error);
        });
      });
    },

    readFile: function readFile(path) {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        _this2.request(_this2.base + "/files/" + path, {
          contentType: "application/vnd.netlify.raw"
        }).then(function (data) {
          resolve(data);
        }, function (error) {
          reject(error);
        });
      });
    },

    /**
      Update files in the repo with a commit.
       A commit message can be specified in `options` as `message`.
       @method updateFiles
      @param {Array} uploads
      @param {Object} options
      @return {Promise} result
    */
    updateFiles: function updateFiles(uploads, options) {
      var _this3 = this;

      var filename, part, parts, subtree;
      var fileTree = {};
      var files = [];

      uploads.forEach(function (file) {
        if (file.uploaded) {
          return;
        }
        files.push(file.upload ? file : _this3.uploadBlob(file));
        parts = file.path.split("/").filter(function (part) {
          return part;
        });
        filename = parts.pop();
        subtree = fileTree;
        while (part = parts.shift()) {
          subtree[part] = subtree[part] || {};
          subtree = subtree[part];
        }
        subtree[filename] = file;
        file.file = true;
      });

      return this.getRef().then(function (ref) {
        return Promise.all(files).then(function () {
          return _this3.getRef();
        }).then(function (ref) {
          return _this3.getCommit(ref.object.sha);
        }).then(function (commit) {
          return _this3.updateTree(commit.tree.sha, "/", fileTree);
        }).then(function (changeTree) {
          return _this3.request(_this3.base + "/commits", {
            type: "POST",
            data: JSON.stringify({ message: options.message, tree: changeTree.sha, parents: [ref.object.sha] })
          });
        }).then(function (response) {
          return _this3.request(_this3.base + "/refs/heads/" + _this3.branch, {
            type: "PATCH",
            data: JSON.stringify({ sha: response.sha })
          });
        });
      });
    },

    /**
      Delete a file in the repo with a commit.
       A commit message can be specified in `options` as `message`.
       @method DeleteFiles
      @param {Object} file
      @param {Object} options
      @return {Promise} result
    */
    deleteFile: function deleteFile(file, options) {
      var _this4 = this;

      var match = (file && file.path || "").match(/^(.*)\/([^\/]+)$/);
      var dir = match && match[1];
      var name = match && match[2];
      if (!name) {
        return Ember['default'].RSVP.Promise.reject("Bad file path");
      }
      return this.listFiles(dir).then(function (files) {
        for (var i = 0; i < files.length; i++) {
          var meta = files[i];
          if (meta.name === name) {
            return _this4.request(_this4.base + "/files/" + meta.path, {
              type: "DELETE",
              data: JSON.stringify({
                message: options.message || "Deleting " + file.path,
                sha: meta.sha,
                branch: _this4.branch
              })
            });
          }
        }
      });
    },

    request: function request(url, settings) {
      return Ember['default'].RSVP.Promise.cast(Ember['default'].$.ajax(url, Ember['default'].$.extend(true, {
        contentType: "application/json",
        headers: { Authorization: "Bearer " + this.token }
      }, settings || {})));
    },

    getRef: function getRef() {
      return this.request(this.base + "/refs/heads/" + this.branch, { cache: false });
    },

    getCommit: function getCommit(sha) {
      return this.request(this.base + "/commits/" + sha);
    },

    getTree: function getTree(sha) {
      return sha ? this.request(this.base + "/trees/" + sha) : Promise.resolve({ tree: [] });
    },

    uploadBlob: function uploadBlob(file) {
      return this.request(this.base + "/blobs", {
        type: "POST",
        data: JSON.stringify({
          content: file.base64 ? file.base64() : Base64.encode(file.content),
          encoding: "base64"
        })
      }).then(function (response) {
        file.sha = response.sha;
        file.uploaded = true;
        return file;
      });
    },

    updateTree: function updateTree(sha, path, fileTree) {
      var _this5 = this;

      return this.getTree(sha).then(function (tree) {
        var obj, filename, fileOrDir;
        var updates = [];
        var added = {};

        for (var i = 0, len = tree.tree.length; i < len; i++) {
          obj = tree.tree[i];
          if (fileOrDir = fileTree[obj.path]) {
            added[obj.path] = true;
            if (fileOrDir.file) {
              updates.push({ path: obj.path, mode: obj.mode, type: obj.type, sha: fileOrDir.sha });
            } else {
              updates.push(_this5.updateTree(obj.sha, obj.path, fileOrDir));
            }
          }
        }
        for (filename in fileTree) {
          fileOrDir = fileTree[filename];
          if (added[filename]) {
            continue;
          }
          updates.push(fileOrDir.file ? { path: filename, mode: "33188", type: "blob", sha: fileOrDir.sha } : _this5.updateTree(null, filename, fileOrDir));
        }
        return Promise.all(updates).then(function (updates) {
          return _this5.request(_this5.base + "/trees", {
            type: "POST",
            data: JSON.stringify({ base_tree: sha, tree: updates })
          });
        }).then(function (response) {
          return { path: path, mode: "16384", type: "tree", sha: response.sha, parentSha: sha };
        });
      });
    }
  });

});
define('cms/backends/test-repo', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var Promise = Ember['default'].RSVP.Promise;

  /**
   TestRepo repository backend.

   ```yaml
   backend:
     name: test_repo
   ```

   It depends on a global variable on the window object called `repoFiles`:

   ```js
   window.repoFiles = {
    "css": {
      "main.css": {
        content: "body { background: red; }"
        sha: "unique-id-for-file-in-this-state"
      }
    },
    "js": {
      "app.js": {
        content: "console.log('Hello');"
        sha: "another-unique-id-for-file-in-this-state"
      }
    }
  }
   ```

   @class TestRepo
   */
  exports['default'] = Ember['default'].Object.extend({
    init: function init() {
      this.delay = this.config.backend.delay || 0;
    },

    authorize: function authorize() {
      return Promise.resolve(true);
    },

    readFile: function readFile(path) {
      var part;
      var parts = path.split("/");
      var file = window.repoFiles;
      while (part = parts.shift()) {
        file = file[part];
        if (!file) {
          return Promise.reject("No such file: " + path);
        }
      }
      return this.withDelay(file.content);
    },

    listFiles: function listFiles(path) {
      var part;
      var parts = path.split("/");
      var files = [];
      var dir = window.repoFiles;
      while (part = parts.shift()) {
        dir = dir[part];
        if (!dir) {
          return Promise.reject("No such dir: " + dir);
        }
      }

      for (var name in dir) {
        files.push({
          name: name,
          path: path + "/" + name,
          content: dir[name].content,
          size: dir[name].content.length,
          sha: dir[name].sha
        });
      }

      return this.withDelay(files);
    },

    updateFiles: function updateFiles(files) {
      var name, parts, part;
      var dir = window.repoFiles,
          subdir;
      files.forEach(function (file) {
        subdir = dir;
        parts = file.path.split("/");
        name = parts.pop();
        while (part = parts.shift()) {
          subdir[part] = subdir[part] || {};
          subdir = subdir[part];
        }
        subdir[name] = {
          content: file.base64 ? Base64.decode(file.base64()) : file.content,
          sha: new Date().getTime()
        };
      });

      return this.withDelay(true, files.length * 10);
    },

    deleteFile: function deleteFile(file) {
      var name, parts, part;
      var dir = window.repoFiles,
          subdir;
      subdir = dir;
      parts = file.path.split("/");
      name = parts.pop();
      while (part = parts.shift()) {
        subdir[part] = subdir[part] || {};
        subdir = subdir[part];
      }
      delete subdir[name];

      return this.withDelay(true, 10);
    },

    withDelay: function withDelay(fn, modifier) {
      var _this = this;

      modifier = modifier || 1;
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(fn.call ? fn() : fn);
        }, _this.delay * 1000 * modifier);
      });
    }
  });
  /*credentials*/

});
define('cms/components/cms-authenticators/base', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    tagName: "",

    authenticationErrorMessage: "Failed to authenticate",
    authorizationErrorMessage: "This user doesn't have permissions to edit this site.",

    // Error message set by the component if authentication fails (ie, user didn't
    // authenticate with github)
    authenticationError: false,
    // Error message set by the login route if the authorization fails (ie, this
    // github user doesn't have access to the repository)
    authorizationError: false,

    error: (function () {
      if (this.get("authenticationError")) {
        return this.get("authenticationErrorMessage");
      } else if (this.get("authorizationError")) {
        return this.get("authorizationErrorMessage");
      }
    }).property("authenticationError", "authorizationError"),

    actions: {
      authenticate: function authenticate() {
        var _this = this;

        this.authenticate().then(function (data) {
          _this.set("authenticationError", false);
          _this.sendAction("action", data);
        })["catch"](function (err) {
          _this.set("authorizationError", err);
        });
      }
    }
  });

});
define('cms/components/cms-authenticators/github-api', ['exports', 'ember', 'cms/components/cms-authenticators/base'], function (exports, Ember, Base) {

  'use strict';

  exports['default'] = Base['default'].extend({
    authenticationErrorMessage: 'Failed to authenticate with GitHub',
    authorizationErrorMessage: 'This GitHub user doesn\'t have permissions to edit this site.',
    tagName: '',
    authenticate: function authenticate() {
      return new Ember['default'].RSVP.Promise(function (resolve, reject) {
        if (document.location.host.split(':')[0] === 'localhost') {
          netlify.configure({ site_id: 'cms.netlify.com' });
        }
        netlify.authenticate({ provider: 'github', scope: 'repo' }, function (err, data) {
          if (err) {
            return reject(err);
          }
          resolve({ github_access_token: data.token });
        });
      });
    }
  });

});
define('cms/components/cms-authenticators/netlify-api', ['exports', 'ember', 'cms/components/cms-authenticators/base'], function (exports, Ember, Base) {

  'use strict';

  var defaultURL = 'http://localhost:8080';

  exports['default'] = Base['default'].extend({
    email: '',
    password: '',

    authenticate: function authenticate() {
      var _this = this;

      var url = this.get('config.backend.url') || defaultURL;
      return new Ember['default'].RSVP.Promise(function (resolve, reject) {
        Ember['default'].$.ajax({
          method: 'POST',
          url: url + '/token',
          data: { grant_type: 'client_credentials' },
          headers: {
            'Authorization': 'Basic ' + btoa(_this.get('email') + ':' + _this.get('password'))
          }
        }).then(function (data) {
          resolve({ access_token: data.access_token });
        }, function (err) {
          reject(err);
        });
      });
    }
  });

});
define('cms/components/cms-authenticators/test-repo', ['exports', 'ember', 'cms/components/cms-authenticators/base'], function (exports, Ember, Base) {

  'use strict';

  exports['default'] = Base['default'].extend({
    authenticate: function authenticate() {
      return Ember['default'].RSVP.Promise.resolve({ noop: true });
    }
  });

});
define('cms/components/cms-breadcrumbs', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    tagName: "",

    /**
     An injected reference to the Ember router.
      @property router
    */
    router: null,
    /**
      An injected reference to the ApplicationController instance.
       @property applicationController
    */
    applicationController: null,

    /**
      Detect if there's a custom `cms/breadcrumbs` template, otherwise use the
      default `components/cms-breadcrumbs` template.
       @property layoutName
    */
    layoutName: (function () {
      return this.container && this.container.lookup("template:cms/breadcrumbs") ? "cms/breadcrumbs" : "components/cms-breadcrumbs";
    }).property("controllers"),

    /* handlers for the current app.
       See https://github.com/chrisfarber/ember-breadcrumbs/blob/master/addon/components/bread-crumbs.js#L11
    */
    handlerInfos: (function () {
      return this.get("router").router.currentHandlerInfos;
    }).property("applicationController.currentPath"),

    /* computed from the handler infos. */
    controllers: (function () {
      return this.get("handlerInfos").map(function (handlerInfo) {
        return handlerInfo.handler.controller;
      });
    }).property("handlerInfos.[]"),

    /**
      The breadcrumbs trail to the current path.
       Each crumbe is an object like:
       {label: String, path: String, model: Model, class: String, last: Bool}
       @property breadcrumbs
    */
    breadcrumbs: (function () {
      var crumbs = [],
          last;
      this.get("controllers").forEach(function (controller) {
        (controller.get("breadcrumbs") || []).forEach(function (crumb) {
          crumbs.push(Ember['default'].$.extend({ "class": "cms-breadcrumb-inactive" }, crumb));
        });
      });

      last = crumbs[crumbs.length - 1];
      last.last = true;
      last["class"] = "cms-breadcrumb-active";

      return crumbs;
    }).property("controllers", "controllers.@each.breadcrumbs"),

    actions: {
      /**
        Transition to the path for a crumb.
         Use this in a custom breadcrumbs template like this:
         ```html
        {{#each crumb in breadcrumbs}}
        <a href="#" {{action "gotoCrumb" crumb}}>{{crumb.label}}</a>
        {{/each}}
        ```
         @method gotoCrumb
        @param {Object} crumb
      */
      gotoCrumb: function gotoCrumb(crumb) {
        var appController = this.get("applicationController");
        var args = [crumb.path];
        if (crumb.model) {
          args.push(crumb.model);
        }
        appController.transitionToRoute.apply(appController, args);
      }
    }
  });

});
define('cms/components/cms-date-input', ['exports', 'ember', 'npm:pikaday'], function (exports, Ember, Pikaday) {

  'use strict';

  exports['default'] = Ember['default'].TextField.extend({
    didInsertElement: function didInsertElement() {
      var picker = new Pikaday['default']({ field: this.$()[0] });
      picker.setMoment(moment(this.get('value')));
      this.set('_picker', picker);
    },

    willDestroyElement: function willDestroyElement() {
      var picker = this.get('_picker');
      if (picker) {
        picker.destroy();
      }
      this.set('_picker', null);
    }
  });

});
define('cms/components/cms-entry-form', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    tagName: "form",
    classNames: ["cms-form", "cms-control-pane"],
    didInsertElement: function didInsertElement() {
      this.$("input,textarea,select").first().focus();
    },
    actions: {
      save: function save() {
        this.sendAction();
      }
    }
  });

});
define('cms/components/cms-expanding-textarea', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].TextArea.extend({
    valueChanged: (function () {
      if (this.element.scrollHeight > this.element.clientHeight) {
        this.element.style.height = this.element.scrollHeight + "px";
      }
    }).observes("value"),

    didInsertElement: function didInsertElement() {
      this.valueChanged();
    }
  });

});
define('cms/components/cms-file-field', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].TextField.extend({
    MAX_FILE_SIZE: 1024 * 1024 * 10, // 10MB
    type: 'file',
    classNames: ['cms-file-field'],
    attributeBindings: ['multiple'],
    change: function change() {
      this.sendAction('action', this.validFiles());
      this.element.value = null;
    },
    validFiles: function validFiles() {
      return Array.prototype.filter.call(this.element.files, (function (file) {
        return this.validateAccept(file) && this.validateSize(file);
      }).bind(this));
    },
    validateAccept: function validateAccept(file) {
      if (!this.accept) {
        return true;
      }
      var i, len, rule;
      var rules = this.accept.split(',');
      for (i = 0, len = rules.length; i < len; i++) {
        rule = rules[i].trim();
        if (rule.indexOf('.') === 0 && file.name.split('.').pop() === rule) {
          return true;
        }
        if (rule === file.type) {
          return true;
        }
        if (rule.match(/^[^\/]+\/\*$/) && file.type.split('/').shift() === rule.split('/').shift()) {
          return true;
        }
      }
      return false;
    },
    validateSize: function validateSize(file) {
      return file.size < this.MAX_FILE_SIZE;
    }
  });

});
define('cms/components/cms-list-entry', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    actionsOpen: false,
    tagName: "",
    actions: {
      toggleActions: function toggleActions() {
        this.set("actionsOpen", !this.get("actionsOpen"));
      },
      publish: function publish() {},
      duplicate: function duplicate() {},
      "delete": function _delete() {}
    }
  });

});
define('cms/components/cms-markdown-editor', ['exports', 'ember', 'cms/utils/sanitizer', 'cms/mixins/keyboard_shortcuts', 'npm:textarea-caret-position'], function (exports, Ember, Sanitizer, Shortcuts, CaretPosition) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend(Shortcuts['default'], {
    init: function init() {
      this._super.apply(this, arguments);
      this._undoStack = [];
      this._redoStack = [];
      this._undoing = false;
      this._selection = null;
      this._checkpoint = this.get('value');
    },
    cleanupPaste: function cleanupPaste(html) {
      return new Sanitizer['default']().sanitize(html);
    },
    tagName: 'div',
    showLinkbox: false,
    linkUrl: null,
    toolbarX: 0,
    toolbarY: 0,
    toolbarOpen: false,
    shortcuts: {
      '⌘+b': 'bold',
      '⌘+i': 'italic',
      '⌘+l': 'link',
      '⇧+⌘+z': 'redo',
      '⌘+z': 'undo'
    },
    _getAbsoluteLinkUrl: function _getAbsoluteLinkUrl() {
      var url = this.get('linkUrl');
      if (url.indexOf('/') === 0) {
        return url;
      }
      if (url.match(/^https?\:\/\//)) {
        return url;
      }
      if (url.match(/^mailto\:/)) {
        return url;
      }
      if (url.match(/@/)) {
        return 'mailto:' + url;
      }
      return 'http://' + url;
    },
    _getSelection: function _getSelection() {
      if (!this.$('textarea')) {
        return null;
      }
      var textarea = this.$('textarea')[0],
          start = textarea.selectionStart,
          end = textarea.selectionEnd;
      return this._selection = { start: start, end: end, selected: (this.get('value') || '').substr(start, end - start) };
    },
    _setSelection: function _setSelection(selection) {
      var _this = this;

      setTimeout(function () {
        var textarea = _this.$('textarea')[0];
        textarea.selectionStart = selection.start;
        textarea.selectionEnd = selection.end;
        textarea.focus();
      }, 0);
    },

    _surroundSelection: function _surroundSelection(chars) {
      var selection = this._getSelection(),
          newSelection = Ember['default'].$.extend({}, selection),
          value = this.get('value') || '',
          changed = chars + selection.selected + chars,
          escapedChars = chars.replace(/\*/g, '\\*'),
          regexp = new RegExp('^' + escapedChars + '.+' + escapedChars + '$');

      if (regexp.test(selection.selected)) {
        changed = selection.selected.substr(chars.length, selection.selected.length - chars.length * 2);
        newSelection.end = selection.end - chars.length * 2;
      } else if (value.substr(selection.start - chars.length, chars.length) === chars && value.substr(selection.end, chars.length) === chars) {
        newSelection.start = selection.start - chars.length;
        newSelection.end = selection.end + chars.length;
        changed = selection.selected;
      } else {
        newSelection.end = selection.end + chars.length * 2;
      }

      var before = value.substr(0, selection.start),
          after = value.substr(selection.end);

      this.set('value', before + changed + after);

      this._setSelection(newSelection);
    },

    _toggleHeadline: function _toggleHeadline(header) {
      var value = this.get('value');
      var selection = this._getSelection();
      var i = selection.start;
      var m, before, after;
      while (i >= 0) {
        if (value.substr(i, 1) === '\n') {
          break;
        } else {
          i--;
        }
      }
      i += 1;
      before = value.substr(0, i);
      after = value.substr(i);
      if (m = after.match(/^(#+)\s/)) {
        if (m[1] === header) {
          after = after.replace(/^#+\s/, '');
          selection.end = selection.end - (m[1].length + 1);
        } else {
          after = after.replace(/^#+/, header);
          selection.end = selection.end - (m[1].length - header.length);
        }
        selection.start = i;
      } else {
        after = header + ' ' + after;
        selection.start = i;
        selection.end = selection.end + header.length + 1;
      }
      this.set('value', before + after);
      this._setSelection(selection);
    },

    linkToFiles: function linkToFiles(files) {
      var media = this.get('media');
      var mediaFiles = [];
      for (var i = 0, len = files.length; i < len; i++) {
        mediaFiles.push(media.add('' + this.get('mediaFolder') + '/' + files[i].name, files[i]));
      }
      return new Ember['default'].RSVP.Promise(function (resolve) {
        var file, image;
        var links = [];
        Ember['default'].RSVP.Promise.all(mediaFiles).then(function (mediaFiles) {
          for (var i = 0, len = mediaFiles.length; i < len; i++) {
            file = mediaFiles[i];
            image = file.name.match(/\.(gif|jpg|jpeg|png|svg)$/);
            links.push('' + (image ? '!' : '') + '[' + file.name + '](' + file.publicPath + ')');
          }
          resolve(links.join('\n'));
        });
      });
    },

    keyDown: function keyDown() {
      this._super.apply(this, arguments);
      this._getSelection();
    },

    getCleanPaste: function getCleanPaste(event) {
      var _this2 = this;

      var transfer = event.originalEvent.clipboardData;
      return new Ember['default'].RSVP.Promise(function (resolve) {
        var data, isHTML;
        for (var i = 0; i < transfer.types.length; i++) {
          if (transfer.types[i] === 'text/html') {
            isHTML = true;
            break;
          }
        }

        if (isHTML) {
          data = transfer.getData('text/html');
          // Avoid trying to clean up full HTML documents with head/body/etc
          if (!data.match(/^\s*<!doctype/i)) {
            event.preventDefault();
            return resolve(_this2.cleanupPaste(data));
          } else {
            // Handle complex pastes by stealing focus with a contenteditable div
            var div = document.createElement('div');
            div.contentEditable = true;
            div.setAttribute('style', 'opacity: 0; overflow: hidden; width: 1px; height: 1px; position: fixed; top: 50%; left: 0;');
            document.body.appendChild(div);
            div.focus();
            setTimeout(function () {
              resolve(_this2.cleanupPaste(div.innerHTML));
              document.body.removeChild(div);
            }, 50);
          }
        } else {
          event.preventDefault();
          resolve(transfer.getData(transfer.types[0]));
        }
      });
    },

    didInsertElement: function didInsertElement() {
      var _this3 = this;

      this.$('textarea').on('dragenter', function (e) {
        e.preventDefault();
      });
      this.$('textarea').on('dragover', function (e) {
        e.preventDefault();
      });
      this.$('textarea').on('drop', (function (e) {
        e.preventDefault();
        var data;

        if (e.originalEvent.dataTransfer.files && e.originalEvent.dataTransfer.files.length) {
          data = this.linkToFiles(e.originalEvent.dataTransfer.files);
        } else {
          data = Ember['default'].RSVP.Promise.resolve(e.originalEvent.dataTransfer.getData('text/plain'));
        }
        data.then((function (text) {
          var selection = this._getSelection();
          var value = this.get('value') || '';

          this.set('value', value.substr(0, selection.start) + text + value.substr(selection.end));
        }).bind(this));
      }).bind(this));

      this.$('textarea').on('paste', function (e) {
        var selection = _this3._getSelection();
        var value = _this3.get('value') || '';
        var before = value.substr(0, selection.start);
        var after = value.substr(selection.end);

        _this3.getCleanPaste(e).then(function (paste) {
          _this3.set('value', before + paste + after);
          selection.start = selection.end = before.length + paste.length;
          _this3._setSelection(selection);
        });
      });

      this.$('textarea').on('blur focus keydown keyup mousedown mouseup', function (e) {
        setTimeout(function () {
          var el = e.originalEvent.target;
          if (!(_this3.get('isDestroyed') || _this3.get('isDestroying'))) {
            _this3.set('toolbarOpen', window.document.activeElement === el && el.selectionStart !== el.selectionEnd);
          }
        }, 0);
      });

      var TextAreaCaretPositoon = new CaretPosition['default'](this.$('textarea')[0]);
      this.$('textarea').on('select', function (e) {
        Ember['default'].run(function () {
          if (!(_this3.get('isDestroyed') || _this3.get('isDestroying'))) {
            var el = e.originalEvent.target;
            var position = TextAreaCaretPositoon.get(el.selectionStart, el.selectionEnd);
            var offset = Ember['default'].$(el).offset();
            _this3.set('toolbarX', Math.max(60, offset.left + position.left));
            _this3.set('toolbarY', offset.top + position.top);
            _this3.set('toolbarOpen', true);
          }
        });
      });
    },

    bookmark: function bookmark(before) {
      var value;
      if (before) {
        value = this._checkpoint;
        this._checkpoint = this.get('value');
      } else {
        value = this._checkpoint = this.get('value');
      }

      return {
        before: this._selection,
        after: this._getSelection(),
        value: value
      };
    },

    appendToHistory: (function () {
      if (this._undoing) {
        this._undoing = false;
      } else {
        this._undoStack.push(this.bookmark(true));
        this._redoStack = [];
      }
    }).observes('value'),

    actions: {
      h1: function h1() {
        this._toggleHeadline('#');
      },
      h2: function h2() {
        this._toggleHeadline('##');
      },
      h3: function h3() {
        this._toggleHeadline('###');
      },
      bold: function bold() {
        this._surroundSelection('**');
      },
      italic: function italic() {
        this._surroundSelection('*');
      },
      link: function link() {
        this._currentSelection = this._getSelection();
        this.set('showLinkbox', true);
        var $ = this.$;
        setTimeout(function () {
          $('.cms-markdown-link-url')[0].focus();
        }, 0);
      },
      insertLink: function insertLink() {
        if (this._currentSelection == null || this.get('showLinkbox') === false) {
          return;
        }
        var selection = this._currentSelection,
            link = '[' + (selection.selected || this.get('linkUrl')) + '](' + this._getAbsoluteLinkUrl() + ')',
            value = this.get('value') || '',
            before = value.substr(0, selection.start),
            after = value.substr(selection.end);

        if (this.get('linkUrl')) {
          this.set('value', before + link + after);
          selection.end = selection.start + link.end;
        }
        this.set('showLinkbox', false);
        this.set('linkUrl', null);
        this._setSelection(selection);
        this._currentSelection = null;
      },
      undo: function undo() {
        var bookmark = this._undoStack.pop();
        if (bookmark) {
          this._redoStack.push(this.bookmark(false));
          this._undoing = true;
          this.set('value', bookmark.value);
          this._setSelection(bookmark.before);
        }
      },
      redo: function redo() {
        var bookmark = this._redoStack.pop();
        if (bookmark) {
          this._undoStack.push(this.bookmark(false));
          this._undoing = true;
          this.set('value', bookmark.value);
          this._setSelection(bookmark.after);
        }
      }
    }
  });

});
define('cms/components/cms-preview-pane', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    tagName: 'div',
    classNames: ['cms', 'cms-preview-pane'],
    hasScrolled: false,

    previewTemplate: (function () {
      var templateName;
      if (this.get('entry.cmsIsDocument')) {
        templateName = 'cms/preview/' + this.get('entry._doc.name');
        if (Ember['default'].TEMPLATES[templateName]) {
          return templateName;
        }
      }
      templateName = 'cms/preview/' + this.get('collection.name');
      return Ember['default'].TEMPLATES[templateName] ? templateName : 'preview/default';
    }).property('entry'),

    scrollTo: function scrollTo() {
      if (!this.get('hasScrolled')) {
        this.set('hasScrolled', true);
        return;
      }
      var mutations = this.get('_mutations');
      var mutation = mutations[0];
      var target;

      switch (mutation.type) {
        case 'childList':
          target = mutation.addedNodes[0];
          break;
        case 'characterData':
          target = mutation.target.parentElement;
          break;
        default:
          target = mutation.target;
          break;
      }
      while (target && target.parentNode && !('offsetTop' in target)) {
        target = target.parentNode;
      }
      if (target && 'offsetTop' in target) {
        this.$().scrollTo(target, 200);
      }
    },

    didInsertElement: function didInsertElement() {
      var _this = this;

      this.observer = new MutationObserver(function (mutations) {
        _this.set('_mutations', mutations);
        Ember['default'].run.debounce(_this, _this.scrollTo, 50);
      });
      var config = { attributes: true, childList: true, characterData: true, subtree: true };
      this.observer.observe(this.$()[0], config);
    },

    willDestroyElement: function willDestroyElement() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }
  });

});
define('cms/components/cms-preview', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    tagName: "",
    widget: (function () {
      var _this = this;

      var target = this.get("from") || this.get("targetObject");
      return target && target.get("widgets") && target.get("widgets").find(function (w) {
        return w.get("name") === _this.get("field");
      });
    }).property("targetObject.entry")
  });

});
define('cms/components/cms-sortable-list', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    tagName: 'ul',
    classNames: ['cms-list'],
    sortableItems: (function () {
      var id = this.get('id') || 'id';
      return this.get('items').map(function (item) {
        return { id: item[id], item: item };
      });
    }).property('items.[]'),

    draggable: (function () {
      return this.get('items').length > 1;
    }).property('items.[]'),

    extraxtOriginalItems: function extraxtOriginalItems(items) {
      return items.map(function (item) {
        return item.item;
      });
    },

    didInsertElement: function didInsertElement() {
      var _this = this;

      this.$().sortable({
        placeholder: '<li class=\'cms-list-placeholder\'/>',
        itemSelector: '.cms-list-item',
        onDrop: function onDrop($item, container, _super) {
          _super($item, container);
          var items = _this.get('sortableItems');
          var newItems = Ember['default'].A();
          var itemLookup = {};
          for (var i = 0, len = items.length; i < len; i++) {
            itemLookup[items[i].id] = items[i];
          }
          _this.$().children('.cms-list-item').each(function () {
            newItems.push(itemLookup[Ember['default'].$(this).data('item')]);
          });
          _this.sendAction('action', _this.extraxtOriginalItems(newItems));
        },
        afterMove: function afterMove($placeholder, container, $closestItemOrContainer) {
          var css = {
            height: $closestItemOrContainer.height(),
            width: $closestItemOrContainer.width()
          };
          $placeholder.css(css);
        }
      });
    },

    _moveItem: function _moveItem(item, direction) {
      var swapWith, index;
      var newItems = this.get('sortableItems');
      for (var i = 0; i < newItems.length; i++) {
        if (newItems[i].id === item.id) {
          swapWith = newItems[i + direction];
          index = i;
          break;
        }
      }
      if (swapWith) {
        if (direction < 0) {
          newItems.replace(index - 1, 2, [item, swapWith]);
        } else {
          newItems.replace(index, 2, [swapWith, item]);
        }
      }
      this.sendAction('action', this.extraxtOriginalItems(newItems));
    },

    actions: {
      removeItem: function removeItem(item) {
        var newItems = this.get('sortableItems').reject(function (i) {
          return i.id === item.id;
        });
        this.sendAction('action', this.extraxtOriginalItems(newItems));
      },
      moveUp: function moveUp(item) {
        this._moveItem(item, -1);
      },
      moveDown: function moveDown(item) {
        this._moveItem(item, 1);
      },
      toggleCollapse: function toggleCollapse(item) {
        console.log('Item: %o', item);
        item.item.set('cmsCollapsed', !item.item.get('cmsCollapsed'));
      }
    }
  });

});
define('cms/components/cms-time-input', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].TextField.extend({
    didInsertElement: function didInsertElement() {
      this.$().timepicker({ className: 'cms cms-timepicker cms-text' });
    },

    willDestroyElement: function willDestroyElement() {
      this.$().timepicker('remove');
    }
  });

});
define('cms/components/cms-widget', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    componentLookupFactory: function componentLookupFactory(fullName, container) {
      container = container || this.container;

      var componentFullName = 'component:' + fullName.replace(/^components\//, '');
      var templateFullName = 'template:' + fullName;
      var templateRegistered = container && container._registry.has(templateFullName);

      if (templateRegistered) {
        container._registry.injection(componentFullName, 'layout', templateFullName);
      }

      var Component = container.lookupFactory(componentFullName);

      // Only treat as a component if either the component
      // or a template has been registered.
      if (templateRegistered || Component) {
        if (!Component) {
          container._registry.register(componentFullName, Ember['default'].Component);
          Component = container.lookupFactory(componentFullName);
        }
        return Component;
      }
    },

    tagName: '',
    type: 'control',
    isControl: (function () {
      return this.get('type') === 'control';
    }).property('type'),
    previewTagName: (function () {
      var field = this.get('widget.field');
      return field && field.hasOwnProperty('tagname') ? field.tagname : 'div';
    }).property('widget'),
    previewClassNames: (function () {
      return (this.get('widget.field.class') || '').split(' ');
    }).property('widget'),
    layoutName: (function () {
      return this.container && this.container.lookup('template:cms/widget') ? 'cms/widget' : 'components/widget';
    }).property('widget'),
    component: function component(name, defaultName) {
      var component = this.componentLookupFactory('cms/widgets/' + name) || this.componentLookupFactory('components/widgets/' + name) || this.componentLookupFactory('components/widgets/' + defaultName);

      return component && component.toString().split(':')[1];
    },
    controlComponent: (function () {
      return this.component(this.get('widget.type') + '-control', 'not-found-control');
    }).property('widget'),
    previewComponent: (function () {
      var name = '' + (this.get('widget.field.preview') || this.get('widget.type')) + '-preview';
      return this.component(name, 'string-preview');
    }).property('widget')
  });

});
define('cms/components/ember-wormhole', ['exports', 'ember-wormhole/components/ember-wormhole'], function (exports, Component) {

	'use strict';

	exports['default'] = Component['default'];

});
define('cms/components/widgets/date_control', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    init: function init() {
      this._super();
      this.get("widget").registerValidator((function (value) {
        return !isNaN(value);
      }).bind(this));

      var value = this.get("widget.value");
      if (value && value instanceof Date) {
        value = moment(value).format(this.get("dateFormat"));
      }

      this.set("value", value);
    },

    onDateStringChange: (function () {

      this.set("widget.value", moment(this.get("value")));
    }).observes("value"),

    dateFormat: (function () {
      var format = this.get("widget.field.format");
      return format ? format : "YYYY-MM-DD";
    }).property("widget.format")
  });

});
define('cms/components/widgets/datetime_control', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    dateFormat: "YYYY-MM-DD",
    timeFormat: "hh:mma",

    init: function init() {
      var date, time, datetime;
      this._super();

      var value = this.get("widget.value");
      if (value) {
        if (typeof value === "object") {
          datetime = moment(value);
          datetime._f = this.get("format");
        } else {
          datetime = moment(value, this.get("format"));
        }

        date = datetime.format(this.get("dateFormat"));
        time = datetime.format(this.get("timeFormat"));
      }

      this.set("time", time);
      this.set("date", date);
    },

    onDateStringChange: (function () {
      var datetime = moment(this.get("datestring"), "YYYY-MM-DD hh:mma");
      if (this.get("time") == null) {
        this.set("time", datetime.format(this.get("timeFormat")));
      }
      datetime._f = this.get("format");
      this.set("widget.value", datetime);
    }).observes("date"),

    onTimeStringChange: (function () {
      var datetime = moment(this.get("datestring"), "YYYY-MM-DD hh:mma");
      datetime._f = this.get("format");
      this.set("widget.value", datetime);
    }).observes("time"),

    format: (function () {
      return this.get("widget.field.format");
    }).property("widget.field.format"),

    datestring: (function () {
      var date = this.get("date"),
          ds;
      if (date) {
        ds = date + " " + (this.get("time") || "");
        return ds;
      }
      return "";
    }).property("date", "time")
  });

});
define('cms/components/widgets/files_control', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    init: function init() {
      this._super();
      this.set("uploads", Ember['default'].A());
      if (!this.get("widget.value")) {
        this.set("widget.value", Ember['default'].A());
      }
    },
    actions: {
      fileUpload: function fileUpload(files) {
        var _this = this;

        var file;
        var media = this.get("media");
        var field = this.get("widget.field");
        for (var i = 0, len = files.length; i < len; i++) {
          file = files[i];
          media.add("/" + (field.folder || "uploads") + "/" + file.name, file).then(function (mediaFile) {
            _this.get("widget.value").pushObject({ label: mediaFile.name, path: mediaFile.path });
          });
        }
      },
      reorder: function reorder(files) {
        this.set("widget.value", files);
      }
    }
  });

});
define('cms/components/widgets/image_control', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    init: function init() {
      this._super();

      var value = this.get("widget.value");
      var upload = value && this.get("media").find(value);
      this.set("widget.src", upload ? upload.src : value);
    },
    actions: {
      fileUpload: function fileUpload(files) {
        var _this = this;

        var file = files[0];
        var media = this.get("media");
        var folder = this.get("widget.mediaFolder");
        media.add(folder + "/" + file.name, file).then(function (mediaFile) {
          _this.set("widget.value", mediaFile.publicPath);
          _this.set("widget.src", mediaFile.src);
        });
      },
      clear: function clear() {
        this.set("widget.value", null);
        this.set("widget.src", null);
      }
    }
  });

});
define('cms/components/widgets/list_control', ['exports', 'ember', 'cms/models/item'], function (exports, Ember, Item) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    /*
      Increases each time we add an item to have a unique identifer for each item
      in the list.
    */
    _itemId: 0,

    /*
      Instantiate a new item and add it to the list.
    */
    _newItem: function _newItem(value) {
      var item = Item['default'].create({
        id: ++this._itemId,
        widget: this.get('widget'),
        value: Ember['default'].$.extend({}, value)
      });

      return item;
    },

    /*
      Initialize the initial items based on the widget value and setup a validator
      that will invalidate the widget unless all item values are valid.
    */
    init: function init() {
      this._super.apply(this, arguments);
      var items = Ember['default'].A();
      var values = this.get('widget.value');
      if (values && values.length) {
        for (var i = 0; i < values.length; i++) {
          items.pushObject(this._newItem(values[i]));
        }
      } else {
        items.pushObject(this._newItem());
      }
      this.set('widget.items', items);
      this.set('widget.addLabel', 'Add ' + (this.get('widget.item_label') || 'one'));
      this.didUpdateItem();
      this.get('widget').registerValidator((function () {
        var items = this.get('widget.items');
        return items && items.every(function (item) {
          return item.isEmpty() || item.isValid();
        });
      }).bind(this));
    },

    /*
      Update the value of the widget whenever the value of one of the widget items
      change.
    */
    didUpdateItem: (function () {
      var value = [];
      this.get('widget.items').forEach(function (item) {
        if (item.isEmpty()) {
          return;
        }
        value.push(item.get('value'));
      });
      this.set('widget.value', value);
    }).observes('widget.items.@each.value'),

    actions: {
      /**
        Add an item to the list
         @method addItem
      */
      addItem: function addItem() {
        this.get('widget.items').pushObject(this._newItem());
      },

      /**
        Reorder the items in the list
         @method reorder
      */
      reorder: function reorder(items) {
        this.set('widget.items', items);
      }
    }
  });

});
define('cms/components/widgets/markdown_preview', ['exports', 'ember', 'npm:virtual-dom/create-element', 'npm:virtual-dom/diff', 'npm:virtual-dom/patch', 'cms/utils/markdown_vdom'], function (exports, Ember, createElement, diff, patch, MarkdownVDOM) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    init: function init() {
      this._super.apply(this, arguments);
    },
    /*
      Wrap the preview in a div
    */
    tagName: 'div',

    /*
      Setup the VDOM element with a VDOM representation of the markdown when the
      component element is inserted into the DOM.
    */
    didInsertElement: function didInsertElement() {
      this.md = new MarkdownVDOM['default'](this.get('media'));
      var vdom = this.md.markdownToVDOM(this.get('widget.value'));
      var rootNode = createElement['default'](vdom);
      this.element.appendChild(rootNode);
      this.set('vdom', vdom);
      this.set('root', rootNode);
    },

    /*
      Create a new VDOM from the markdown and patch the current VDOM with a diff
      whenever the widget value changes.
    */
    updateVDOM: (function () {
      if (!this.md) {
        return;
      }
      var vdom = this.get('vdom');
      var newTree = this.md.markdownToVDOM(this.get('widget.value'));
      var patches = diff['default'](vdom, newTree);
      var rootNode = patch['default'](this.get('root'), patches);
      this.set('root', rootNode);
      this.set('vdom', newTree);
    }).observes('widget.value')
  });

});
define('cms/components/widgets/number_control', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    init: function init() {
      this._super();
      this.get("widget").registerValidator((function (value) {
        return !isNaN(parseInt(value, 10));
      }).bind(this));

      this.set("value", this.get("widget.value"));
    },

    onDateStringChange: (function () {
      var value = parseInt(this.get("value"), 10);
      if (isNaN(value)) {
        this.set("widget.value", null);
      } else {
        this.set("widget.value", value);
      }
    }).observes("value")
  });

});
define('cms/components/widgets/object_control', ['exports', 'ember', 'cms/models/item'], function (exports, Ember, Item) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    init: function init() {
      this._super.apply(this, arguments);
      this.set('widget.item', Item['default'].create({
        widget: this.get('widget'),
        value: this.get('widget.value') || {}
      }));
      this.get('widget').registerValidator((function () {
        var item = this.get('widget.item');
        return item && item.isEmpty() || item.isValid();
      }).bind(this));
      this.set('item', this.get('widget.item'));
    },

    collapsed: false,

    /*
      Update the value of the widget whenever the value of one of the item
      change.
    */
    didUpdateItem: (function () {
      this.set('widget.value', this.get('widget.item.value'));
    }).observes('widget.item.value'),

    actions: {
      toggleCollapse: function toggleCollapse() {
        this.set('collapsed', !this.get('collapsed'));
      }
    }
  });

});
define('cms/components/widgets/slug_control', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Component.extend({
    userValue: null,
    slug: Ember['default'].computed("widget.entry.cmsUserSlug", "userValue", {
      get: function get() {
        return this.get("userValue") || this.get("widget.entry.cmsUserSlug");
      },
      set: function set(key, value) {
        this.set("widget.value", value);
        this.set("userValue", this.get("widget.value"));
        return value;
      }
    })
  });

});
define('cms/controllers/application', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    init: function init() {
      var _this = this;

      this._super.apply(this, arguments);
      Ember['default'].$(document).ajaxError(function (event, jqXHR /*, ajaxSettings, thrownError*/) {
        // You should include additional conditions to the if statement so that this
        // only triggers when you're absolutely certain it should
        if (jqXHR.status === 401) {
          _this.set("showLoginModal", true);
        }
      });
    },
    showLoginModal: false,
    authorizationError: null,
    authenticator: (function () {
      return "cms-authenticators/" + (this.get("config.backend.authenticator") || this.get("config.backend.name"));
    }).property("config.authenticator.name"),
    templateName: "application",
    breadcrumbs: [{
      label: "Content",
      path: "index"
    }],
    collections: Ember['default'].computed.alias("config.collections"),
    actions: {
      toggleCollections: function toggleCollections() {
        this.set("showCollections", !this.get("showCollections"));
      },
      toggleProfile: function toggleProfile() {
        this.set("showProfile", !this.get("showProfile"));
      },
      newEntry: function newEntry(collection) {
        this.set("showCollections", false);
        this.transitionToRoute("create", collection);
      },
      login: function login(data) {
        var _this2 = this;

        this.get("repository").authorize(data).then(function () {
          _this2.get("authstore").store(data);
          if (_this2.get("showLoginModal")) {
            _this2.set("showLoginModal", false);
          } else {
            _this2.transitionToRoute("index");
          }
        }, function (err) {
          _this2.set("controller.authorizationError", err);
        });
      }
    }
  });

});
define('cms/controllers/array', ['exports', 'ember'], function (exports, Ember) {

	'use strict';

	exports['default'] = Ember['default'].Controller;

});
define('cms/controllers/entry', ['exports', 'ember', 'cms/models/widget'], function (exports, Ember, Widget) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    templateName: 'entry',

    needs: ['application'],

    /**
     The path to the file in the repository representing the current entry
      @property entryPath
    */
    entryPath: Ember['default'].computed.alias('entry._path'),

    /**
      Whether this is a new record or an already persisted record
       @property newRecord
    */
    newRecord: (function () {
      return this.get('entry.cmsNewRecord');
    }).property('entry.cmsNewRecord'),

    canCreate: (function () {
      return !!this.get('collection.create');
    }).property('collection.create'),

    canDelete: (function () {
      return !this.get('entry.cmsNewRecord') && this.get('collection.create');
    }).property('collection.create', 'entry.cmsNewRecord'),

    /**
      Prepare the controller. The router calls this when setting up the controller.
       @method prepare
      @param {Object} collection
      @param {Object} entry
    */
    prepare: function prepare(collection, entry) {
      this.set('collection', collection);
      this.set('entry', entry);
    },

    /**
     Convert a title to a slug suitable for use in URLs and filenames.
      @method slugify
     @param {String} text
     @return {String} slug
    */
    slugify: function slugify(text) {
      return text.toString().toLowerCase().replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, ''); // Trim - from end of text
    },

    /**
     Resolve the repository path for the current entry.
      If the entry is a new entry it creates a new path for the entry.
      Right now there's no check to see if we're overwriting an existing path.
      The method returns a Promise, since in the future we'll need to check with
     the repository whether there's already a file with this name (and that's an
     async operation).
      @method getFilePath
     @return {Ember.RSVP.Promise} filepath
    */
    getFilePath: function getFilePath() {
      return Ember['default'].RSVP.Promise.resolve(this.get('entry.cmsPath'));
    },

    /**
     Label for the current action (Edit/Create)
      @property currentAction
    */
    currentAction: (function () {
      return this.get('newRecord') ? 'Create' : 'Edit';
    }).property('newRecord'),

    /**
     Breadcrumbs for this controller.
      @property breadcrumbs
    */
    breadcrumbs: (function () {
      if (this.get('entryPath')) {
        return [{
          label: '' + this.get('collection.label') + ' List',
          path: 'index.list',
          model: this.get('collection')
        }, {
          label: 'Edit ' + this.get('collection.label'),
          path: 'edit',
          model: this.get('entry')
        }];
      } else {
        return [{
          label: '' + this.get('collection.label') + ' List',
          path: 'index.list',
          model: this.get('collection')
        }, {
          label: 'New ' + this.get('collection.label'),
          path: 'create',
          model: this.get('collection')
        }];
      }
    }).property('currentAction', 'collection.label', 'entry'),

    /**
     The widgets for this entry.
      One widget is instantiated for each of the fields in the collection.
      @property widgets
    */
    widgets: (function () {
      var _this = this;

      var widgets = Ember['default'].A();

      (this.get('entry.cmsFields') || []).forEach(function (field) {
        var value = _this.get('entry.' + field.name);
        if (typeof value === 'undefined') {
          value = field['default'] || null;
        }
        widgets.push(Widget['default'].create({
          field: field,
          entry: _this.get('entry'),
          value: value
        }));
      });

      return widgets;
    }).property('entry'),

    meta: (function () {
      var _this2 = this;

      var meta = Ember['default'].A();

      var defaultFields = [];
      if (!this.get('entry.cmsIsDocument')) {
        defaultFields.push({ label: 'Slug', name: 'cmsUserSlug', widget: 'slug' });
      }
      var existingDateField = (this.get('collection.fields') || []).filter(function (f) {
        return f.name === 'date';
      })[0];
      var existingDateMeta = (this.get('collection.meta') || []).filter(function (f) {
        return f.name === 'date';
      })[0];
      if (!(existingDateField || existingDateMeta || this.get('entry.cmsIsDocument'))) {
        defaultFields.push({ label: 'Publish Date', name: 'date', widget: 'date', 'default': 'now' });
      }

      defaultFields.concat(this.get('collection.meta') || []).forEach(function (field) {
        var value = _this2.get('entry.' + field.name);
        if (typeof value === 'undefined') {
          value = field['default'] || null;
        }
        meta.push(Widget['default'].create({
          field: field,
          entry: _this2.get('entry'),
          value: value
        }));
      });

      return meta;
    }).property('entry'),

    /**
      The `valid` state of the current entry.
       An entry is valid if each of the widgets is valid.
       @property isValid
    */
    isValid: (function () {
      return this.get('widgets').every(function (widget) {
        return widget.get('isValid');
      });
    }).property('widgets.@each.isValid'),

    /**
      Opposite of `isValid`.
       @property isInvalid
    */
    isInvalid: Ember['default'].computed.not('isValid'),

    disableButton: (function () {
      return this.get('isInvalid') || this.get('saving');
    }).property('isInvalid', 'saving'),

    /**
      Check for a ts.json with a deploy timestamp and poll it if it exists.
       Send a desktop notification once it changes.
       @method notifyOnDeploy
    */
    notifyOnDeploy: function notifyOnDeploy() {
      if (this.deployChecker) {
        return;
      }
      var base = Ember['default'].$('base').attr('href') || '/';
      Ember['default'].$.getJSON(base + 'ts.json').then((function (data) {
        var current = data.ts;
        this.deployChecker = (function () {
          Ember['default'].$.getJSON(base + 'ts.json').then((function (data) {
            var state = data.ts;
            if (state !== current) {
              this.get('notifications').notify('Changes are live', 'Your site has been built and deployed.');
            } else {
              setTimeout(this.deployChecker, 1000);
            }
          }).bind(this));
        }).bind(this);
        this.deployChecker();
      }).bind(this));
    },

    actions: {
      toggleActions: function toggleActions() {
        this.set('actionsOpen', !this.get('actionsOpen'));
      },

      /**
        Saves the current entry if valid.
         Tells the repository to commit the fileContent of the current entry and
        all uploaded media files.
         @method save
      */
      save: function save() {
        var _this3 = this;

        this.set('errorMessage', null);
        if (this.get('isInvalid')) {
          this.set('errorMessage', this.get('widgets').find(function (w) {
            return !w.get('isValid');
          }).get('label') + ' has not been filled out correctly');
          return;
        }

        this.set('saving', true);
        this.get('entry').cmsSave(this.get('widgets'), this.get('meta')).then(function (entry) {
          _this3.set('saving', false);
          _this3.set('actionsOpen', false);
          _this3.get('widgets').forEach(function (w) {
            w.set('dirty', false);
          });

          _this3.transitionToRoute('edit', entry);
        })['catch'](function (err) {
          // Definitively needs better error reporting here...
          console.log('Error saving: %o', err);
          _this3.set('error', err);
        });
      },

      'delete': function _delete() {
        var _this4 = this;

        console.log('Deleted');
        if (this.get('newRecord')) {
          // Can't delete if not persisted...
          return;
        }

        if (confirm('Are you sure you want to delete this entry?')) {
          this.set('saving', true);
          this.get('entry').cmsDelete().then(function () {
            _this4.set('saving', false);
            _this4.set('actionsOpen', false);
            _this4.send('hideSidebar');
            _this4.transitionToRoute('index.list', _this4.get('collection'));
          })['catch'](function (err) {
            // Definitively needs better error reporting here...
            console.log('Error saving: %o', err);
            _this4.set('error', err);
          });
        }
      }
    }
  });

});
define('cms/controllers/index', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    templateName: 'index',
    needs: ['application'],
    prepare: function prepare(config) {
      this.set('config', config);
    },
    collections: Ember['default'].computed.alias('config.collections')
  });

});
define('cms/controllers/list', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    templateName: "entries",
    breadcrumbs: (function () {
      return [{
        label: "" + this.get("collection.label") + " List",
        path: "index.list",
        model: this.get("collection")
      }];
    }).property("collection"),
    needs: ["application"],
    prepare: function prepare(collection) {
      this.set("collection", collection);
      this.loadEntries();
    },
    loadEntries: function loadEntries() {
      var _this = this;

      this.set("loading_entries", true);
      this.get("collection").loadEntries().then(function (entries) {
        _this.set("entries", entries);
        _this.set("loading_entries", false);
      })["catch"](function (err) {
        alert("Error loading documents from " + _this.get("collection.label"));
        console.log(err);
      });
    }
  });

});
define('cms/controllers/login', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    authorizationError: null,

    authenticator: (function () {
      return "cms-authenticators/" + (this.get("config.backend.authenticator") || this.get("config.backend.name"));
    }).property("config.authenticator.name"),

    actions: {
      login: function login(data) {
        var _this = this;

        this.get("repository").authorize(data).then(function () {
          _this.get("authstore").store(data);
          _this.transitionToRoute("index");
        }, function (err) {
          _this.set("controller.authorizationError", err);
        });
      }
    }
  });

});
define('cms/controllers/object', ['exports', 'ember'], function (exports, Ember) {

	'use strict';

	exports['default'] = Ember['default'].Controller;

});
define('cms/formats/json', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Object.extend({
    extension: "json",
    fromFile: function fromFile(content) {
      return JSON.parse(content);
    },
    toFile: function toFile(data) {
      return JSON.stringify(data);
    },
    excerpt: function excerpt() {
      return "A JSON Document";
    }
  });

});
define('cms/formats/markdown-frontmatter', ['exports', 'cms/formats/markdown', 'cms/formats/yaml'], function (exports, MarkdownFormatter, YAML) {

  'use strict';

  exports['default'] = MarkdownFormatter['default'].extend({
    extension: "md",
    fromFile: function fromFile(content) {
      var regexp = /^---\n([^]*?)\n---\n([^]*)$/;
      var match = content.match(regexp);
      var obj = match ? YAML['default'].create({}).fromFile(match[1]) : {};
      obj.body = match ? (match[2] || "").replace(/^\n+/, "") : content;
      return obj;
    },
    toFile: function toFile(data) {
      var meta = {};
      var body = "";
      var content = "";
      for (var key in data) {
        if (key === "body") {
          body = data[key];
        } else {
          meta[key] = data[key];
        }
      }

      content += "---\n";
      content += YAML['default'].create({}).toFile(meta);
      content += "---\n\n";
      content += body;
      return content;
    }
  });

});
define('cms/formats/markdown-jade-frontmatter', ['exports', 'cms/formats/markdown-frontmatter'], function (exports, MarkdownFrontmatterFormatter) {

  'use strict';

  exports['default'] = MarkdownFrontmatterFormatter['default'].extend({
    extension: "jade",
    indent: function indent(content, indentation) {
      var indentedContent = [];
      var lines = content.split("\n");
      for (var i = 0, len = lines.length; i < len; i++) {
        indentedContent.push(indentation + lines[i]);
      }
      return indentedContent.join("\n");
    },
    fromFile: function fromFile(content) {
      var line, lines, match;
      var markdown = null;
      var indentation = null;
      var obj = this._super(content);
      obj.jade_body = obj.body;

      lines = (obj.jade_body || "").split("\n");
      for (var i = 0, len = lines.length; i < len; i++) {
        line = lines[i];
        if (markdown === null) {
          match = line.match(/^\s*:markdown\s*$/);
          if (match) {
            markdown = [];
          }
        } else {
          if (indentation === null) {
            match = line.match(/^(\s+)/);
            indentation = match[1];
          }
          if (line.indexOf(indentation) === 0 || line.match(/^\s*$/)) {
            markdown.push(line.substr(indentation.length) || "");
          } else {
            break;
          }
        }
      }

      if (obj.hasOwnProperty("title") === false) {
        obj.title = (markdown[0] || "").replace(/^#+\s*/, "");
      }

      obj.body = markdown ? markdown.join("\n") : null;

      return obj;
    },
    toFile: function toFile(obj, entry) {
      var line, lines, match;
      var markdown = null;
      var done = null;
      var indentation = null;
      var body = [];
      var meta = {};
      var content = "";
      var originalContent = entry.get("cmsFileContent") || "";
      var bodyTpl = originalContent.replace(/^---\n([^]*?)\n---\n/, "") || ":markdown\n  ";

      for (var key in obj) {
        if (key !== "body") {
          meta[key] = obj[key];
        }
      }

      content += "---\n";
      content += jsyaml.safeDump(meta);
      content += "---\n\n";

      lines = bodyTpl.split("\n");
      for (var i = 0, len = lines.length; i < len; i++) {
        line = lines[i];
        if (markdown === null || done) {
          body.push(line);
          match = done ? null : line.match(/^\s*:markdown\s*$/);
          if (match) {
            markdown = [];
          }
        } else {
          if (indentation === null) {
            match = line.match(/^(\s+)/);
            indentation = match[1];
          }
          if (line.indexOf(indentation) === 0) {} else {
            body.push(this.indent(obj.body || "", indentation));
            done = true;
          }
        }
      }
      if (markdown && !done) {
        body.push(this.indent(obj.body || "", indentation || "  "));
      }

      return content + body.join("\n");
    }
  });

  // Ignore line

});
define('cms/formats/markdown-jade', ['exports', 'cms/formats/markdown'], function (exports, MarkdownFormatter) {

  'use strict';

  exports['default'] = MarkdownFormatter['default'].extend({
    extension: "jade",
    indent: function indent(content, indentation) {
      var indentedContent = [];
      var lines = content.split("\n");
      for (var i = 0, len = lines.length; i < len; i++) {
        indentedContent.push(indentation + lines[i]);
      }
      return indentedContent.join("\n");
    },
    fromFile: function fromFile(content) {
      var line, lines, match;
      var markdown = null;
      var indentation = null;
      var obj = {};

      lines = (content || "").split("\n");
      for (var i = 0, len = lines.length; i < len; i++) {
        line = lines[i];
        if (markdown === null) {
          match = line.match(/^\s*:markdown\s*$/);
          if (match) {
            markdown = [];
          }
        } else {
          if (indentation === null) {
            match = line.match(/^(\s+)/);
            indentation = match[1];
          }
          if (line.indexOf(indentation) === 0 || line.match(/^\s*$/)) {
            markdown.push(line.substr(indentation.length) || "");
          } else {
            break;
          }
        }
      }

      obj.title = (markdown[0] || "").replace(/^#+\s*/, "");
      obj.body = markdown ? markdown.join("\n") : null;

      return obj;
    },
    toFile: function toFile(obj, entry) {
      var line, lines, match;
      var markdown = null;
      var done = null;
      var indentation = null;
      var body = [];
      var originalContent = entry.get("cmsFileContent") || "";
      var bodyTpl = originalContent.replace(/^---\n([^]*?)\n---\n/, "") || ":markdown\n  ";

      lines = bodyTpl.split("\n");
      for (var i = 0, len = lines.length; i < len; i++) {
        line = lines[i];
        if (markdown === null || done) {
          body.push(line);
          match = done ? null : line.match(/^\s*:markdown\s*$/);
          if (match) {
            markdown = [];
          }
        } else {
          if (indentation === null) {
            match = line.match(/^(\s+)/);
            indentation = match[1];
          }
          if (line.indexOf(indentation) === 0) {} else {
            body.push(this.indent(obj.body || "", indentation));
            done = true;
          }
        }
      }
      if (markdown && !done) {
        body.push(this.indent(obj.body || "", indentation || "  "));
      }

      return body.join("\n");
    }
  });

  // Ignore line

});
define('cms/formats/markdown-python', ['exports', 'cms/formats/markdown', 'cms/formats/yaml'], function (exports, MarkdownFormatter, YAML) {

  'use strict';

  exports['default'] = MarkdownFormatter['default'].extend({
    extension: "md",
    fromFile: function fromFile(content) {
      var lines = content.split(/\n\r?/);
      var meta = [];
      var body = [];

      for (var i = 0, len = lines.length; i < len; i++) {
        if (body.length === 0 && lines[i].match(/^\w+:.+/)) {
          meta.push(lines[i]);
        } else if (body.length || lines[i]) {
          body.push(lines[i]);
        }
      }

      var obj = meta.length ? YAML['default'].create({}).fromFile(meta.join("\n")) : {};
      obj.body = body.length ? body.join("\n") : "";
      return obj;
    },
    toFile: function toFile(data) {
      var meta = {};
      var body = "";
      var content = "";
      for (var key in data) {
        if (key === "body") {
          body = data[key];
        } else {
          meta[key] = data[key];
        }
      }

      content += YAML['default'].create({}).toFile(meta);
      content += "\n";
      content += body;
      return content;
    }
  });

});
define('cms/formats/markdown', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Object.extend({
    extension: "md",
    fromFile: function fromFile(content) {
      var title = ((content || "").split("\n")[0] || "").replace(/^#+\s*/, "");
      return { title: title, body: content };
    },
    toFile: function toFile(obj) {
      return obj.body;
    },
    excerpt: function excerpt(content) {
      var excerpt = "";
      var line = null;
      var lines = content.split("\n");
      while (!excerpt && lines.length) {
        line = lines.shift();
        // Skip Markdown headers (this should be specific to the format)
        if (line.indexOf("#") === 0 || line.indexOf(">") === 0) {
          continue;
        }
        // Skip markdown headers or hrs (this should be specific to the format)
        if (lines[0] && lines[0].match(/^(-+|=+)$/)) {
          lines.shift();
          continue;
        }
        excerpt = line.trim();
      }
      return line;
    }
  });

});
define('cms/formats/yaml', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var MomentType = new jsyaml.Type('date', {
    kind: 'scalar',
    predicate: function predicate(value) {
      return moment.isMoment(value);
    },
    represent: function represent(value) {
      return value.format(value._f);
    },
    resolve: function resolve(value) {
      return moment.isMoment(value) && value._f;
    }
  });

  var OutputSchema = new jsyaml.Schema({
    include: jsyaml.DEFAULT_SAFE_SCHEMA.include,
    implicit: [MomentType].concat(jsyaml.DEFAULT_SAFE_SCHEMA.implicit),
    explicit: jsyaml.DEFAULT_SAFE_SCHEMA.explicit
  });

  exports['default'] = Ember['default'].Object.extend({
    extension: 'yml',
    fromFile: function fromFile(content) {
      return jsyaml.safeLoad(content);
    },
    toFile: function toFile(data) {
      return jsyaml.safeDump(data, { schema: OutputSchema });
    },
    excerpt: function excerpt() {
      return 'A YAML Document';
    }
  });

});
define('cms/helpers/time-format', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports.timeFormat = timeFormat;

  function timeFormat(params /*, hash*/) {
    if (params.length !== 2) {
      return "Usage: {{time-format date \"format\"}}";
    }

    return moment(params[0]).format(params[1]);
  }

  exports['default'] = Ember['default'].Helper.helper(timeFormat);

});
define('cms/initializers/app-version', ['exports', 'cms/config/environment', 'ember'], function (exports, config, Ember) {

  'use strict';

  var classify = Ember['default'].String.classify;
  var registered = false;

  exports['default'] = {
    name: 'App Version',
    initialize: function initialize(container, application) {
      if (!registered) {
        var appName = classify(application.toString());
        Ember['default'].libraries.register(appName, config['default'].APP.version);
        registered = true;
      }
    }
  };

});
define('cms/initializers/authstore-service', ['exports'], function (exports) {

  'use strict';

  exports.initialize = initialize;

  function initialize(container, application) {
    application.inject('route', 'authstore', 'service:authstore');
    application.inject('controller', 'authstore', 'service:authstore');
  }

  exports['default'] = {
    name: 'authstore-service',
    initialize: initialize
  };

});
define('cms/initializers/breadcrumbs', ['exports'], function (exports) {

  'use strict';

  exports['default'] = {
    name: "ember-breadcrumbs",
    initialize: function initialize(container, app) {
      app.inject("component:cms-breadcrumbs", "router", "router:main");
      app.inject("component:cms-breadcrumbs", "applicationController", "controller:application");
    }
  };

});
define('cms/initializers/cms-config', ['exports', 'ember', 'cms/services/config'], function (exports, Ember, Config) {

  'use strict';

  exports.initialize = initialize;

  function loadYamlConfig() {
    if (Ember['default'].$("#cms-yaml-config").length) {
      return Ember['default'].RSVP.Promise.resolve(Ember['default'].$("#cms-yaml-config").html());
    } else {
      return Ember['default'].$.get("config.yml");
    }
  }
  function initialize(container, application) {
    application.deferReadiness();
    loadYamlConfig().then(function (yaml) {
      var data = jsyaml.safeLoad(yaml);

      if (typeof CMS_ENV === "string" && data[CMS_ENV]) {
        for (var key in data[CMS_ENV]) {
          if (data[CMS_ENV].hasOwnProperty(key)) {
            data[key] = data[CMS_ENV][key];
          }
        }
      }

      var config = Config['default'].create(data);
      application.register("cms:config", config, { instantiate: false });
      application.inject("route", "config", "cms:config");
      application.inject("controller", "config", "cms:config");
      application.inject("service", "config", "cms:config");
      application.inject("model", "config", "cms:config");
      application.inject("component", "config", "cms:config");
      application.advanceReadiness();
    });
  }

  exports['default'] = {
    name: "config-service",
    initialize: initialize
  };

});
define('cms/initializers/export-application-global', ['exports', 'ember', 'cms/config/environment'], function (exports, Ember, config) {

  'use strict';

  exports.initialize = initialize;

  function initialize(container, application) {
    var classifiedName = Ember['default'].String.classify(config['default'].modulePrefix);

    if (config['default'].exportApplicationGlobal && !window[classifiedName]) {
      window[classifiedName] = application;
    }
  }

  ;

  exports['default'] = {
    name: 'export-application-global',

    initialize: initialize
  };

});
define('cms/initializers/media-service', ['exports'], function (exports) {

  'use strict';

  exports.initialize = initialize;

  function initialize(container, application) {
    application.inject('component', 'media', 'service:media');
    application.inject('service:repository', 'media', 'service:media');
  }

  exports['default'] = {
    name: 'media-service',
    initialize: initialize
  };

});
define('cms/initializers/notifications-service', ['exports'], function (exports) {

  'use strict';

  exports.initialize = initialize;

  function initialize(container, application) {
    application.inject('controller', 'notifications', 'service:notifications');
  }

  exports['default'] = {
    name: 'notifications-service',
    initialize: initialize
  };

});
define('cms/initializers/repository-service', ['exports'], function (exports) {

  'use strict';

  exports.initialize = initialize;

  function initialize(container, application) {
    application.inject('route', 'repository', 'service:repository');
    application.inject('controller', 'repository', 'service:repository');
  }

  exports['default'] = {
    name: 'repository-service',
    initialize: initialize
  };

});
define('cms/instance-initializers/cms-config', ['exports'], function (exports) {

  'use strict';

  exports['default'] = {
    initialize: function initialize(instance) {
      var config = instance.container.lookup("cms:config");
      config.set("container", instance.container);
      config.set("ready", true);
    }
  };

});
define('cms/instance-initializers/repository-service', ['exports'], function (exports) {

  'use strict';

  exports['default'] = {
    initialize: function initialize(instance) {
      var repo = instance.container.lookup("service:repository");
      var config = instance.container.lookup("cms:config");

      repo.backendFactory = instance.container.lookupFactory("backend:" + config.backend.name);
      repo.reset(config);
    }
  };

});
define('cms/mixins/keyboard_shortcuts', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var MODIFIERS = {
    '⇧': 16, shift: 16,
    '⌥': 18, alt: 18, option: 18,
    '⌃': 17, ctrl: 17, control: 17,
    '⌘': 91, command: 91
  };

  /* Lookup table for shortcut definitions */
  var DEFINITIONS = {
    backspace: 8, tab: 9, clear: 12,
    enter: 13, 'return': 13,
    esc: 27, escape: 27, space: 32,
    left: 37, up: 38,
    right: 39, down: 40,
    del: 46, 'delete': 46,
    home: 36, end: 35,
    pageup: 33, pagedown: 34,
    ',': 188, '.': 190, '/': 191,
    '`': 192, '-': 189, '=': 187,
    ';': 186, '\'': 222,
    '[': 219, ']': 221, '\\': 220
  };
  for (var n = 1; n < 20; n++) {
    DEFINITIONS['f' + n] = 111 + n;
  }

  /* Helper function to get a charcode from a shortcut definition. */
  function code(c) {
    return DEFINITIONS[c] || c.toUpperCase().charCodeAt(0);
  }

  /* Normalize keyCode for ⌘ */
  function normalize(kc) {
    return kc === 93 || kc === 224 ? 91 : kc;
  }

  /* helper method for determining if a keycode is a modifier key */
  function isMod(kc) {
    return kc === 16 || kc === 17 || kc === 18 || kc === 91;
  }

  /* parse a shortcut definition */
  function parse(component, key, action) {
    var parts = key.replace(/\s+/g, '').split('+');
    var kc = code(parts.pop());
    var m,
        mods = {};

    parts.forEach(function (part) {
      if (m = MODIFIERS[part]) {
        mods[m] = true;
      }
    });

    return { mods: mods, kc: kc, raw: key, action: action };
  }

  /**
    Add keyboard shortcut to a component.

    ## Usage:

    ```javascript
    export default Ember.Component.extend(KeyboardShortcuts, {
      shortcuts: {
        '⌘+s': 'save'
      },

      actions: {
        save: function() {
          // Gets triggered when the user press ⌘+s from within the component.
        }
      }
    });
    ```

    @class KeyboardShortcuts
    @extend Ember.Mixin
  */
  exports['default'] = Ember['default'].Mixin.create({
    init: function init() {
      this._super.apply(this, arguments);
      this._registered_shortcuts = [];
      this._reset();
      this._registerShortcut();
    },

    _registerShortcut: function _registerShortcut() {
      if (!this.shortcuts) {
        return;
      }
      for (var key in this.shortcuts) {
        var def = parse(this, key, this.shortcuts[key]);
        this._registered_shortcuts[def.kc] = this._registered_shortcuts[def.kc] || [];
        this._registered_shortcuts[def.kc].push(def);
      }
    },

    _dispatchShortcut: function _dispatchShortcut(event) {
      var _this = this;

      var kc = normalize(event.keyCode);

      this._pressed[kc] = true;

      if (isMod(kc)) {
        this._pressed_mods[kc] = true;
        return;
      }

      this._updatePressedMods(event, kc);

      if (!(kc in this._registered_shortcuts)) {
        return;
      }

      (this._registered_shortcuts[kc] || []).forEach(function (def) {
        if (_this._modsMatch(def)) {
          event.preventDefault();
          _this.send(def.action);
        }
      });
    },

    _updatePressedMods: function _updatePressedMods(event) {
      if (event.shiftKey) {
        this._pressed_mods[16] = true;
      }
      if (event.ctrlKey) {
        this._pressed_mods[17] = true;
      }
      if (event.altKey) {
        this._pressed_mods[18] = true;
      }
      if (event.metaKey) {
        this._pressed_mods[91] = true;
      }
    },

    _modsMatch: function _modsMatch(def) {
      var mods = def.mods;
      return mods[16] === this._pressed_mods[16] && mods[17] === this._pressed_mods[17] && mods[18] === this._pressed_mods[18] && mods[91] === this._pressed_mods[91];
    },

    _clear: function _clear(event) {
      var kc = normalize(event.keyCode);
      if (this._pressed[kc]) {
        this._pressed[kc] = undefined;
      }
      if (this._pressed_mods[kc]) {
        this._pressed_mods[kc] = undefined;
      }
    },

    _reset: function _reset() {
      this._pressed = {};
      this._pressed_mods = {};
    },

    keyDown: function keyDown(e) {
      this._super.apply(this, arguments);
      this._dispatchShortcut(e);
    },
    keyUp: function keyUp(e) {
      this._super.apply(this, arguments);
      this._clear(e);
    },
    focus: function focus(e) {
      this._super.apply(this, arguments);
      this._reset(e);
    }

  });

});
define('cms/models/collection', ['exports', 'ember', 'cms/models/entry'], function (exports, Ember, Entry) {

  'use strict';

  function slugFormatterFn(template) {
    if (!template) {
      return function (entry) {
        return entry.get('cmsUserSlug');
      };
    }

    return function (entry) {
      return template.replace(/\{\{([^\}]+)\}\}/g, function (_, name) {
        switch (name) {
          case 'year':
            return entry.get('cmsDate').year();
          case 'month':
            return entry.get('cmsDate').month() + 1;
          case 'day':
            return entry.get('cmsDate').date();
          case 'slug':
            return entry.get('cmsUserSlug');
          default:
            return entry.get(name);
        }
      });
    };
  }

  /**
  @module app
  @submodule models
  */

  /**
   A Collection of entries

   @class Collection
   @extends Ember.Object
   */

  var Collection = Ember['default'].Object.extend({
    /* Set the id and format. Default format is markdown with frontmatter */
    init: function init() {
      this._super.apply(this, arguments);
      this.id = this.name;
      this.slugFormatter = slugFormatterFn(this.slug);
    },

    id: Ember['default'].computed.alias('name'),
    collection_id: Ember['default'].computed.alias('name'),

    /**
      The extension for documents in this collection
       @method getExtension
      @return {String} extension
    */
    getExtension: function getExtension() {
      return this.get('extension') || this.get('formatter.extension');
    },

    /**
      The formatter for this collection
      Note: a collection of individual file documents, might have a different formatter
      for each document and in that case this will return null
       @property formatter
    */
    formatter: (function () {
      return this.get('config.container').lookup('format:' + this.get('format'));
    }).property('config.ready'),

    /**
      The Git repository we're working on
       @property repository
    */
    repository: (function () {
      return this.get('config.container').lookup('service:repository');
    }).property('config.container'),

    /**
      Get the formatter for a path
       If the collection has an explicit formatter set, that will be returned. Otherwise
      the formatter will be determined based on the file extension.
       @method getFormatter
      @param {String} path
      @return {Format} formatter
    */
    getFormatter: function getFormatter(path) {
      if (path && this.get('files')) {
        var doc = this.get('files').find(function (doc) {
          return doc.file === path;
        });
        if (doc && doc.format) {
          return this.get('config.container').lookup('format:' + doc.format);
        }
      }

      if (this.get('format')) {
        return this.get('formatter');
      }
      if (this.get('config.format')) {
        return this.get('config.formatter');
      }
      // TODO: Make this work with custom formatters
      var extension = (path || '').split('.').pop();
      switch (extension) {
        case 'json':
          return this.get('config.container').lookup('format:json');
        case 'yml':
          return this.get('config.container').lookup('format:yaml');
        case 'md':
          return this.get('config.container').lookup('format:markdown-frontmatter');
      }
    },

    /**
      The folder where media should be stored for this collection.
       @property mediaFolder
    */
    mediaFolder: (function () {
      return this.get('media_folder') || this.get('config.media_folder') || 'uploads';
    }).property('media_folder', 'config.media_folder'),

    /**
      Loads all entries from a folder. If an extension is specified for the collection,
      only files with that extension will be processed.
       @method loadEntriesFromFolder
      @return {Promise} entries
    */
    loadEntriesFromFolder: function loadEntriesFromFolder() {
      var _this = this;

      var repository = this.get('repository');
      var extension = this.getExtension() || 'md';

      if (!repository) {
        return Ember['default'].RSVP.Promise.resolve([]);
      }

      return repository && repository.listFiles(this.get('folder')).then(function (files) {
        files = files.filter(function (file) {
          return extension == null || file.name.split('.').pop() === extension;
        }).map(function (file) {
          return Entry['default'].fromFile(_this, file);
        });
        return Ember['default'].RSVP.Promise.all(files);
      });
    },

    /**
      Loads entries from individual files specified directly in the collection configuration.
       @method loadEntriesFromFiles
      @return {Promise} entries
    */
    loadEntriesFromFiles: function loadEntriesFromFiles() {
      var _this2 = this;

      var repository = this.get('repository');

      var files = this.get('files').map(function (doc) {
        return repository.readFile(doc.file).then(function (content) {
          return { path: doc.file, content: content, doc: doc };
        }, function (err) {
          console.log('Error reading file :( %o', err);
        });
      });
      return Ember['default'].RSVP.Promise.all(files).then(function (files) {
        return files.map(function (file) {
          return Entry['default'].fromContent(_this2, file.content, file.path, { _doc: file.doc });
        });
      });
    },

    /**
      Loads the entries in this collection
       @method loadEntries
      @return {Promise} entries
    */
    loadEntries: function loadEntries() {
      if (this.get('folder')) {
        return this.loadEntriesFromFolder();
      } else if (this.get('files')) {
        return this.loadEntriesFromFiles();
      } else if (this.get('file')) {
        return this.loadEntriesFromFile();
      } else {
        alert('This collection doesn\'t have any entries configured. Set either \'folder\', \'file\' or \'files\' in your config.yml');
      }
    },

    /**
      Find an entry by slug.
       @method findEntry
      @param {String} slug
      @return {Promise} entry
    */
    findEntry: function findEntry(slug) {
      if (this.get('folder')) {
        var path = this.get('folder') + '/' + slug + '.' + (this.getExtension() || 'md');
        return Entry['default'].fromFile(this, { path: path });
      } else if (this.get('files')) {
        var doc = this.get('files').find(function (doc) {
          return doc.name === slug;
        });
        return doc ? Entry['default'].fromFile(this, { path: doc.file }, { _doc: doc }) : Ember['default'].RSVP.Promise.reject('File not found');
      } else if (this.get('file')) {} else {
        alert('This collection doesn\'t have any entries configured. Set either \'folder\', \'file\' or \'files\' in your config.yml');
      }
    }
  });

  exports['default'] = Collection;

  // TODO: Load multiple entries from a single document

});
define('cms/models/entry', ['exports', 'ember', 'cms/utils/slugify'], function (exports, Ember, slugify) {

  'use strict';

  var Entry = Ember['default'].Object.extend({
    /**
      Excerpt of the entry for the entry listing
       @property cmsExcerpt
    */
    cmsExcerpt: (function () {
      if (this.get('_doc.description')) {
        return this.get('_doc.description');
      }
      var excerpt = this.get('excerpt') || this.get('description');
      return excerpt || this.get('_formatter').excerpt(this.get('body'));
    }).property('body'),

    /**
      The `date` of the entry. Will either be a date or created_at attribute, the date based on the
      current URL of the entry or todays date.
       @property cmsDate
    */
    cmsDate: (function () {
      return this.get('date') || this.get('created_at') || this.get('dateFromUrl') || moment();
    }).property('date', 'created_at', 'dateFromUrl'),

    /**
      The slug we'll show to the user in the meta input for slug.
       This is often different from the filename of the document. Ie, when using a
      permalink structure like "{year}-{month}-{day}-{slug}", the user slug will
      only be the final slug part.
       @property cmsUserSlug
    */
    cmsUserSlug: Ember['default'].computed('title', {
      get: function get() {
        return slugify.slugify(this.get('_cmsUserSlug') || this.get('title') || '');
      },
      set: function set(key, value) {
        value = slugify.slugify(value);
        this.set('_cmsUserSlug', value);
        return value;
      }
    }),

    /**
      The title of an entry showed in lists, relations, etc...
       @property cmsTitle
    */
    cmsTitle: (function () {
      if (this.get('_doc.label')) {
        return this.get('_doc.label');
      }
      return this.get('title') || this.get('cmsSlug');
    }).property('title', '_doc'),

    /**
      The slug of an entry
       @property cmsSlug
    */
    cmsSlug: (function () {
      if (this.get('cmsIsDocument')) {
        return this.get('_doc.name');
      } else if (this.get('_path')) {
        return this.get('_path').split('/').pop().split('.').slice(0, -1).join('.');
      } else {
        return this.get('_collection.slugFormatter')(this);
      }
    }).property('cmsUserSlug', 'cmsDate', 'title', '_doc'),

    /**
      File path of an entry within the repository
       @property cmsPath
    */
    cmsPath: (function () {
      if (this.get('cmsIsDocument')) {
        return this.get('_doc.file');
      }
      return this.get('_path') || this.get('_collection.folder') + '/' + this.get('cmsSlug') + '.' + (this.get('_collection').getExtension() || 'md');
    }).property('cmsSlug'),

    /**
      All the fields this entry has
       @property cmsFields
    */
    cmsFields: (function () {
      return (this.get('_collection.fields') || []).concat(this.get('_doc.fields') || []);
    }).property('_doc'),

    /**
      Whether this entry is a document (in a collection of individual document files)
      or an entry (a collection with similar entry types)
       @property cmsIsDocument
    */
    cmsIsDocument: (function () {
      return this.get('_doc') ? true : false;
    }).property('_doc'),

    /**
      Convert the entry to file content via the `format` of the collection.
       @method toFileContent
      @param {Array} widgets
      @param {Array} metaFields
      @return {String} fileContent
    */
    toFileContent: function toFileContent(widgets, metaFields) {
      var widget;
      var meta;
      var i;
      var len;
      var obj = {};
      var formatter = this.get('_collection').getFormatter(this.get('cmsPath'));

      for (i = 0, len = widgets.length; i < len; i++) {
        widget = widgets[i];
        obj[widget.get('name')] = widget.getValue();
      }

      for (i = 0, len = metaFields.length; i < len; i++) {
        meta = metaFields[i];
        obj[meta.get('name')] = meta.getValue();
      }

      return formatter.toFile(obj, this);
    },

    /**
      Whether this entry is a new record or an existing file
       @property cmsNewRecord
    */
    cmsNewRecord: (function () {
      return !this.get('_path');
    }).property('_path'),

    /**
      The orignal file content of the entry.
       @property cmsFileContent
    */
    cmsFileContent: Ember['default'].computed.alias('_file_content'),

    /**
      The date of the entry inferred from the current URL of the entry.
       Right now this is a really naive method, always assuming that entries are stored via:
       `yyyy-mm-dd-slug`
       @property dateFromUrl
    */
    dateFromUrl: (function () {
      // TODO: check collection.entry_path to figure out if we have date parts in the url
      if (!this._path) {
        return null;
      }

      var name = this._path.split('/').pop();
      var match = name.match(/^(\d\d\d\d-\d\d-\d\d)-/);
      if (match) {
        return new Date(match[1]);
      }
    }).property('_path'),

    /**
      Save the entry (must pass in the widgets and metaFields from the controller)
       @method toFileContent
      @param {Array} widgets
      @param {Array} metaFields
      @return {Promise} entry
    */
    cmsSave: function cmsSave(widgets, metaFields) {
      var _this = this;

      var path = this.get('cmsPath');
      var files = [{ path: path, content: this.toFileContent(widgets, metaFields) }];
      var commitMessage = (this.get('cmsNewRecord') ? 'Created ' : 'Updated ') + this.get('_collection.label') + ' ' + this.get('cmsTitle');

      return this.get('_collection.repository').updateFiles(files, { message: commitMessage }).then(function () {
        return _this;
      });
    },

    /**
      Delete the entry
       @method cmsDelete
      @return {Promise} deleted
    */
    cmsDelete: function cmsDelete() {
      if (!this.get('_collection.create')) {
        throw 'Can\'t delete entries in collections with creation disabled';
      }
      var file = { path: this.get('cmsPath') };
      var commitMessage = 'Deleted ' + this.get('_collection.label') + ' ' + this.get('cmsTitle');

      return this.get('_collection.repository').deleteFile(file, { message: commitMessage });
    }
  });

  Entry.reopenClass({
    /**
      Instantiates a new entry model from a file content.
       @method fromContent
      @param {Collection} collection
      @param {String} content
      @param {String} path
      @param {Object} metadata
      @static
      @return {Entry} entry
    */
    fromContent: function fromContent(collection, content, path, metadata) {
      var formatter = collection.getFormatter(path);
      return Entry.create(Ember['default'].$.extend(formatter.fromFile(content), { _collection: collection, _path: path, _file_content: content, _formatter: formatter }, metadata));
    },

    /**
      Instantiates a new entry model from a file object
       @method fromFile
      @param {Collection} collection
      @param {File} file
      @param {Object} metadata
      @static
      @return {Entry} entry
    */
    fromFile: function fromFile(collection, file, metadata) {
      return collection.get('repository').readFile(file.path, file.sha).then(function (content) {
        return Entry.fromContent(collection, content, file.path, metadata);
      });
    }
  });

  exports['default'] = Entry;

});
define('cms/models/item', ['exports', 'ember', 'cms/models/widget'], function (exports, Ember, Widget) {

  'use strict';

  exports['default'] = Ember['default'].Object.extend({
    init: function init() {
      var _this = this;

      var widgets = [];
      this._super.apply(this, arguments);
      this.set('_collection', this.get('widget.collection'));
      var value = this.get('value');
      (this.get('widget.field.fields') || []).forEach(function (field) {
        widgets.push(Widget['default'].create({
          field: field,
          value: value && value[field.name],
          entry: _this
        }));
      });
      this.set('widgets', widgets);

      // Make sure the initial setup of the value gets registered
      this.valueDidChange();
    },
    id: null,
    widgets: null,
    isValid: function isValid() {
      return this.get('widgets').every(function (widget) {
        return widget.get('isValid');
      });
    },
    isEmpty: function isEmpty() {
      return this.get('widgets').every(function (widget) {
        return !widget.get('value');
      });
    },
    valueDidChange: (function () {
      var _this2 = this;

      var value = {};
      this.get('widgets').forEach(function (widget) {
        value[widget.get('name')] = widget.getValue();
        _this2.set(widget.get('name'), widget.getValue());
      });
      this.set('value', value);
    }).observes('widgets.@each.value'),

    cmsFirstField: (function () {
      var widget = this.get('widgets')[0];
      var v = widget && widget.getValue();
      return ('' + v).substr(0, 50);
    }).property('widgets.@each.value')
  });

});
define('cms/models/widget', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var Validator = Ember['default'].Object.extend({
    value: Ember['default'].computed.alias("model.value"),
    isValid: (function () {
      return this.validate(this.get("value"), this.options);
    }).property("model.value")
  });

  /* Built in validators. Just `presence` right now */
  var Validators = {
    presence: Validator.extend({
      validate: function validate(value, options) {
        if (options === false) {
          return true;
        }
        return !!value;
      }
    })
  };

  /**
    Each field for an entry or a document in a collection has a `Widget` that
    represents the UI for entering the value of that field.

    @class Widget
    @extends Ember.Object
  */
  var Widget = Ember['default'].Object.extend({
    /**
      True if the value of this widget has been modified
       @property dirty
      @type Boolean
    */
    dirty: false,

    /**
      The field that this widget reflects the value of
       @property field
      @type Object
    */
    field: null,

    /**
      The entry the widget belongs to. Useful if a preview or a validation
      depends on another value (a field might be required only if a checkbox is
      checked).
       @property entry
      @type Entry
    */
    entry: null,

    /**
      The current value of the widget
       @property value
    */
    value: null,

    /**
      The name of the field this widget represents
       @property name
      @type String
    */
    name: Ember['default'].computed.alias("field.name"),

    /**
      The label of the field this widget represents
       @property label
      @type String
    */
    label: Ember['default'].computed.alias("field.label"),

    /**
      The type of the field this widget represents (the name of the widget)
       @property type
      @type String
    */
    type: Ember['default'].computed.alias("field.widget"),

    /**
      True if the widget is hidden and should not show up in the ui.
       @property hidden
      @type Boolean
    */
    hidden: (function () {
      return this.get("field.widget") === "hidden";
    }).property("field.widget"),

    collection: Ember['default'].computed.alias("entry._collection"),

    mediaFolder: (function () {
      return this.get("field.media_folder") || this.get("collection.mediaFolder");
    }).property("collection", "field.media_folder"),

    /* Set up the validators forthis widget */
    init: function init() {
      this._super();
      var validators = Ember['default'].A();
      if (this.isRequired()) {
        validators.pushObject(Validators.presence.create({ model: this, options: true }));
      }
      this.validators = validators;
    },

    /**
      Add a validator to the widget.
       If you're creating your own component for the controller of the widget, this
      method can be used to add a validator to the widget itself that needs to be
      valid before the entry can be saved.
       A validFn will receive the `value` of the widget and must return true if it is
      valid.
       @method registerValidator
      @param {Function} validFn
    */
    registerValidator: function registerValidator(validFn) {
      this.validators.pushObject(Validator.create({ model: this, validate: validFn }));
    },

    /**
      Whether the value of this widget is required optional.
       @property isRequired
      @type Boolean
    */
    isRequired: function isRequired() {
      if (this.field.widget === "checkbox" || this.field.optional) {
        return false;
      }
      return this.field.options !== true;
    },

    /**
      True if the value of the widget is valid
       @property isValid
      @type Boolean
    */
    isValid: (function () {
      return this.get("validators").every(function (validator) {
        return validator.get("isValid");
      });
    }).property("validators.@each.isValid"),

    /**
      false if the value of the widget is valid
       @property isInvalid
      @type Boolean
    */
    isInvalid: Ember['default'].computed.not("isValid"),

    /**
      true if the widget is both dirty and invalid.
       @property dirtyAndInvalid
      @type Boolean
    */
    dirtyAndInvalid: (function () {
      return this.get("dirty") && this.get("isInvalid");
    }).property("dirty", "isInvalid"),

    /*
      Small helper function to `get` the value
    */
    getValue: function getValue() {
      return this.get("value");
    },

    /*
      Update the corresponding value on the enrty whenever the value changes.
    */
    onValuechange: (function () {
      var name = this.get("name"),
          value = this.get("value");
      this.set("dirty", true);
      if (this.entry) {
        this.entry.set(name, value);
      }
    }).observes("value")
  });

  exports['default'] = Widget;

  exports.Validators = Validators;

});
define('cms/router', ['exports', 'ember', 'cms/config/environment'], function (exports, Ember, config) {

  'use strict';

  var Router = Ember['default'].Router.extend({
    location: config['default'].locationType
  });

  Router.map(function () {
    this.route('login');
    this.route('index', { path: '/' }, function () {
      this.route('dashboard', { path: '/' });
      this.route('list', { path: '/collections/:collection_id' });
    });
    this.route('create', { path: '/collections/:collection_id/entries' });
    this.route('edit', { path: '/collections/:collection_id/entries/:slug' });
  });

  exports['default'] = Router;

});
define('cms/routes/application', ['exports', 'cms/routes/cms'], function (exports, Route) {

  'use strict';

  exports['default'] = Route['default'].extend({
    actions: {
      showSidebar: function showSidebar() {
        this.set("controller.showSidebar", true);
      },
      hideSidebar: function hideSidebar() {
        this.set("controller.showSidebar", false);
      },
      toggleSidebar: function toggleSidebar() {
        this.set("controller.showSidebar", !this.get("controller.showSidebar"));
      }
    }
  });

});
define('cms/routes/authenticated', ['exports', 'cms/routes/cms'], function (exports, Route) {

  'use strict';

  exports['default'] = Route['default'].extend({
    actions: {
      logout: function logout() {
        this.get("authstore").clear();
        this.get("repository").reset(this.get("config"));
        this.transitionTo("login");
      }
    },
    beforeModel: function beforeModel() {
      var _this = this;

      var credentials = this.get("authstore").stored();
      if (credentials) {
        this.get("repository").authorize(credentials).then(function () {}, function (err) {
          console.log("Authentication error: %o", err);
          _this.get("authstore").clear();
          _this.transitionTo("login");
        });
      } else {
        this.transitionTo("login");
      }
    }
  });

});
define('cms/routes/cms', ['exports', 'ember'], function (exports, Ember) {

	'use strict';

	exports['default'] = Ember['default'].Route.extend({});

});
define('cms/routes/create', ['exports', 'cms/routes/authenticated', 'cms/models/entry'], function (exports, AuthenticatedRoute, Entry) {

  'use strict';

  exports['default'] = AuthenticatedRoute['default'].extend({
    model: function model(params) {
      return this.get("config").findCollection(params.collection_id);
    },

    controllerName: "entry",

    setupController: function setupController(controller, model) {
      this._super();
      controller.prepare(model, Entry['default'].create({ _collection: model }));
    },

    renderTemplate: function renderTemplate() {
      this.render("entry");
      this.render("entry-sidebar", { outlet: "sidebar" });
    },

    actions: {
      willTransition: function willTransition(transition) {
        if (this.get("controller.widgets").filter(function (w) {
          return w.get("value") && w.get("dirty");
        }).length === 0) {
          return;
        }
        if (!confirm("Discard changes?")) {
          transition.abort();
        }
      }
    }

  });

});
define('cms/routes/edit', ['exports', 'cms/routes/authenticated'], function (exports, AuthenticatedRoute) {

  'use strict';

  exports['default'] = AuthenticatedRoute['default'].extend({
    serialize: function serialize(model) {
      return {
        collection_id: model.get("_collection.id"),
        slug: model.get("cmsSlug")
      };
    },

    model: function model(params) {
      var collection = this.get("config").findCollection(params.collection_id);
      return collection.findEntry(params.slug);
    },

    controllerName: "entry",

    setupController: function setupController(controller, model) {
      this._super();
      this.collection = model._collection;
      controller.prepare(this.collection, model);
    },

    renderTemplate: function renderTemplate() {
      this.render("entry");
      this.render("entry-sidebar", { outlet: "sidebar" });
    },

    actions: {
      willTransition: function willTransition(transition) {
        if (this.controller.get("widgets").filter(function (w) {
          return w.get("dirty");
        }).length === 0) {
          return;
        }
        if (!confirm("Discard changes?")) {
          transition.abort();
        }
      }
    }
  });

});
define('cms/routes/index', ['exports', 'cms/routes/authenticated'], function (exports, AuthenticatedRoute) {

  'use strict';

  exports['default'] = AuthenticatedRoute['default'].extend({
    model: function model() {
      return this.get("config");
    },
    setupController: function setupController(controller, model) {
      controller.prepare(model);
    }
  });

});
define('cms/routes/index/dashboard', ['exports', 'cms/routes/authenticated'], function (exports, AuthenticatedRoute) {

  'use strict';

  exports['default'] = AuthenticatedRoute['default'].extend({
    model: function model() {
      return this.get("config").collections[0];
    },
    afterModel: function afterModel(model /*, transition*/) {
      this.transitionTo("index.list", model);
    }
  });
  /*params*/

});
define('cms/routes/index/list', ['exports', 'cms/routes/authenticated'], function (exports, AuthenticatedRoute) {

  'use strict';

  exports['default'] = AuthenticatedRoute['default'].extend({
    model: function model(params) {
      return this.get("config").findCollection(params.collection_id);
    },

    controllerName: "list",

    setupController: function setupController(controller, model) {
      this._super();
      controller.prepare(model);
    },

    templateName: "collection"
  });

});
define('cms/routes/login', ['exports', 'cms/routes/cms'], function (exports, Route) {

	'use strict';

	exports['default'] = Route['default'].extend({});

});
define('cms/services/authstore', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Service.extend({
    isServiceFactory: true,
    store: function store(data) {
      if (window.localStorage) {
        window.localStorage.setItem('cms.credentials', JSON.stringify(data));
      }
    },
    stored: function stored() {
      if (window.localStorage) {
        var stored = window.localStorage.getItem('cms.credentials');
        return stored && JSON.parse(stored);
      }
    },
    clear: function clear() {
      if (window.localStorage) {
        window.localStorage.removeItem('cms.credentials');
      }
    }
  });

});
define('cms/services/config', ['exports', 'ember', 'cms/models/collection'], function (exports, Ember, Collection) {

  'use strict';

  exports['default'] = Ember['default'].Service.extend({
    isServiceFactory: true,
    /*
      Instantiate all the collections
    */
    init: function init() {
      var collection;
      var collections = [];
      for (var i = 0, len = this.collections && this.collections.length; i < len; i++) {
        collection = Collection['default'].create(this.collections[i]);
        collection.set('config', this);
        collections.push(collection);
      }
      this.collections = collections;
    },

    ready: false,

    container: null,

    /**
      The default formatter
       @property formatter
    */
    formatter: (function () {
      return this.get('container').lookup('format:' + this.get('format'));
    }).property('config.format'),

    /**
      Find the collection matching the `id`
       @method findCollection
      @param {String} id
      @return {Collection} collection
    */
    findCollection: function findCollection(id) {
      return this.collections.filter(function (c) {
        return c.id === id;
      })[0];
    }
  });

});
define('cms/services/media', ['exports', 'ember', 'cms/utils/slugify'], function (exports, Ember, slugify) {

  'use strict';

  var Promise = Ember['default'].RSVP.Promise;

  var MediaFile = Ember['default'].Object.extend({
    uploaded: false,
    name: null,
    size: 0,
    path: null,
    publicPath: null,
    src: null,
    base64: function base64() {
      return this.src && this.src.split(',').pop();
    }
  });

  function normalize(path) {
    return (path || '').split('/').map(function (el) {
      return slugify.urlify(el);
    }).join('/');
  }

  /**
    Media service is a global media handler.

    This service is used to upload new files to the CMS. When a commit is made,
    these files will be included and added to the repository.

    @class Media
    @extends Ember.Object
  */

  exports['default'] = Ember['default'].Service.extend({
    isServiceFactory: true,
    uploads: Ember['default'].A(),
    uploaded: Ember['default'].A(),
    add: function add(path, file) {
      var _this = this;

      path = normalize(path);
      var name = path.split('/').pop();

      this.remove(path);
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var mediaFile = MediaFile.create({
            name: name,
            size: file.size,
            path: path,
            publicPath: _this.publicPathFor(path),
            src: reader.result
          });
          _this.uploads.pushObject(mediaFile);
          resolve(mediaFile);
        };
        reader.onerror = function () {
          reject('Unable to read file');
        };
        reader.readAsDataURL(file);
      });
    },
    find: function find(path) {
      var upload = this.get('uploads').find(function (mediaFile) {
        return mediaFile.path === path.replace(/^\//, '');
      });
      return upload || this.get('uploaded').find(function (mediaFile) {
        return mediaFile.path === path.replace(/^\//, '');
      });
    },
    remove: function remove(path) {
      this.set('uploads', this.get('uploads').reject(function (mediaFile) {
        return path === mediaFile.path;
      }));
    },
    reset: function reset() {
      this.set('uploaded', this.get('uploaded').concat(this.get('uploads')));
      this.set('uploads', Ember['default'].A());
      return true;
    },
    srcFor: function srcFor(path) {
      var base = this.get('config.public_folder');
      var mediaFile = this.find(base ? base + path : path);
      return mediaFile ? mediaFile.src : path;
    },
    publicPathFor: function publicPathFor(path) {
      var base = this.get('config.public_folder');
      return base ? path.replace(new RegExp('^/?' + base + '/'), '/') : '/' + path;
    }
  });

});
define('cms/services/notifications', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Service.extend({
    defaultIcon: "/favicon.ico",

    withPermission: function withPermission() {
      return new Ember['default'].RSVP.Promise(function (resolve, reject) {
        if (!window.Notification) {
          return reject("Browser doesn't support notifications");
        }
        if (window.Notification.permission === "granted") {
          return resolve(true);
        }
        if (window.Notification.permission === "denied") {
          return reject("Permission to send notifications denied");
        }
        window.Notification.requestPermission(function (permission) {
          return permission ? resolve(true) : reject("Permission to send notifications denied");
        });
      });
    },

    notify: function notify(title, body) {
      var settings = this.get("config.notifications") || {};
      var icon = settings.icon || this.defaultIcon;
      this.withPermission().then(function () {
        new window.Notification(title, {
          icon: icon,
          body: body
        });
      }, function (err) {
        console.log(err);
      });
    }
  });

});
define('cms/services/object_cache/cache', ['exports', 'ember', 'cms/services/object_cache/indexed_db', 'cms/services/object_cache/local_storage', 'cms/services/object_cache/memory'], function (exports, Ember, IndexedDBCache, LocalStorageCache, MemoryCache) {

  'use strict';

  exports['default'] = Ember['default'].Object.extend({
    init: function init() {
      this._super();
      if (window.indexedDB) {
        this.cache = IndexedDBCache['default'].create({});
      } else if (window.localStorage) {
        this.cache = LocalStorageCache['default'].create({});
      } else {
        this.cache = MemoryCache['default'].create({});
      }
    },
    get: function get(key) {
      return this.cache.get(key);
    },
    set: function set(key, value) {
      return this.cache.set(key, value);
    }
  });

});
define('cms/services/object_cache/indexed_db', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var Promise = Ember['default'].RSVP.Promise;

  exports['default'] = Ember['default'].Object.extend({
    db: "cms.cache",
    objectStore: "cms.cache",
    withDB: function withDB() {
      return new Promise((function (resolve, reject) {
        var request = window.indexedDB.open(this.db, 1);
        request.onerror = reject;
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onupgradeneeded = (function (event) {
          var db = event.target.result;
          try {
            db.createObjectStore(this.objectStore, { keyPath: "key" });
          } catch (e) {
            console.log("Object store creation failed: %o", e);
          }
        }).bind(this);
      }).bind(this));
    },
    withObjectStore: function withObjectStore(write) {
      return new Promise((function (resolve, reject) {
        this.withDB().then((function (db) {
          var transaction = db.transaction([this.objectStore], write ? "readwrite" : "readonly");
          var objectStore = transaction.objectStore(this.objectStore);
          resolve(objectStore);
        }).bind(this), reject);
      }).bind(this));
    },
    get: function get(key) {
      return new Promise((function (resolve, reject) {
        this.withObjectStore().then(function (objectStore) {
          var request = objectStore.get(key);
          request.onerror = reject;
          request.onsuccess = function () {
            if (request.result) {
              resolve(request.result.value);
            } else {
              reject();
            }
          };
        }, reject);
      }).bind(this));
    },
    set: function set(key, value) {
      return new Promise((function (resolve, reject) {
        this.withObjectStore(true).then(function (objectStore) {
          var request = objectStore.add({ key: key, value: value });
          request.onerror = reject;
          request.onsuccess = function () {
            resolve(value);
          };
        });
      }).bind(this));
    }
  });

});
define('cms/services/object_cache/local_storage', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var Promise = Ember['default'].RSVP.Promise;

  exports['default'] = Ember['default'].Object.extend({
    prefix: "cms.cache",
    get: function get(key) {
      var value = window.localStorage.getItem(this.prefix + "." + key);
      return value ? Promise.resolve(value) : Promise.reject();
    },
    set: function set(key, value) {
      window.localStorage.setItem(this.prefix + "." + key, value);
      return Promise.resolve(value);
    }
  });

});
define('cms/services/object_cache/memory', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var Promise = Ember['default'].RSVP.Promise;

  exports['default'] = Ember['default'].Object.extend({
    cache: {},
    get: function get(key) {
      var value = this.cache[key];
      return value ? Promise.resolve(value) : Promise.reject();
    },
    set: function set(key, value) {
      this.cache[key] = value;
      return Promise.resolve(value);
    }
  });

});
define('cms/services/repository', ['exports', 'ember', 'cms/services/object_cache/cache'], function (exports, Ember, Cache) {

  'use strict';

  exports['default'] = Ember['default'].Service.extend({
    init: function init() {
      this.fileCache = Cache['default'].create({});
    },

    /**
      Authorize with the backend and instantiate the backend.
       @method configure
      @param {Object} credentials
      @return {Promise} result
    */
    authorize: function authorize(credentials) {
      return this.backend.authorize(credentials);
    },

    /**
      Used when logging out. Makes sure the repository settings is reset and that
      the current in memory repo can longer be used to make calls to the repo API.
       @method reset
    */
    reset: function reset(config) {
      this.backend = this.backendFactory.create({ config: config });
    },

    /**
      Read the files from a specific path of the repository
       @method listFiles
      @param {String} path
      @return {Promise} files
    */
    listFiles: function listFiles(path) {
      return this.backend.listFiles(path);
    },

    /**
      Read the content of a file.
       If an optional sha is specified, the content will be read from the local cache
      if present.
       @method readFile
      @param {String} path
      @param {String} sha
      @return {Promise} content
    */
    readFile: function readFile(path, sha) {
      if (sha) {
        return this.fileCache.get(sha).then(function (content) {
          return content;
        }, (function () {
          return this.backend.readFile(path).then((function (content) {
            this.fileCache.set(sha, content);
            return content;
          }).bind(this));
        }).bind(this));
      } else {
        return this.backend.readFile(path);
      }
    },

    deleteFile: function deleteFile(path, options) {
      return this.backend.deleteFile(path, options);
    },

    /**
      Takes a list of files that should be updated in the repository. Will also fetch
      any uploads in the media store and add them to the commit.
       Each file must be a {path, content} object.
       Only option at this point is a `message` that will be used as the commit message.
       @method updateFiles
      @param {Array} files
      @param {Object} options
      @return {Promise} response
    */
    updateFiles: function updateFiles(files, options) {
      var media = this.get('media');
      var uploads = (files || []).concat(media.get('uploads'));

      return this.backend.updateFiles(uploads, options);
    }
  });

});
define('cms/templates/application', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 6,
              "column": 12
            },
            "end": {
              "line": 8,
              "column": 12
            }
          },
          "moduleName": "cms/templates/application.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("              ");
          dom.appendChild(el0, el1);
          dom.setNamespace("http://www.w3.org/2000/svg");
          var el1 = dom.createElement("svg");
          dom.setAttribute(el1,"viewBox","0 0 200 200");
          dom.setAttribute(el1,"style","-webkit-transform: rotate(45deg); -ms-transform(45deg); transform: rotate(45deg)");
          dom.setAttribute(el1,"version","1.1");
          dom.setAttribute(el1,"xmlns","http://www.w3.org/2000/svg");
          dom.setAttribute(el1,"xmlns:xlink","http://www.w3.org/1999/xlink");
          var el2 = dom.createElement("g");
          dom.setAttribute(el2,"class","nf-logo-bg");
          dom.setAttribute(el2,"stroke","none");
          dom.setAttribute(el2,"stroke-width","1");
          dom.setAttribute(el2,"fill","#3FB5A0");
          var el3 = dom.createElement("path");
          dom.setAttribute(el3,"d","M0,0 L200,0 L200,200 L0,200 L0,0 Z");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("g");
          dom.setAttribute(el2,"id","nf-logo-lines");
          dom.setAttribute(el2,"stroke","rgb(39,46,48)");
          dom.setAttribute(el2,"stroke-width","8");
          dom.setAttribute(el2,"fill","none");
          var el3 = dom.createElement("path");
          dom.setAttribute(el3,"d","M205,66 L-4,205 Z");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3,"d","M205,2 L-4,89 Z");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3,"d","M205,176 L-4,141 Z");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3,"d","M84,205 L39,-4 Z");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3,"d","M205,168 L85,-4 Z");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("path");
          dom.setAttribute(el3,"d","M133,-4 L53,205 Z");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("g");
          dom.setAttribute(el2,"id","nf-logo-circles");
          dom.setAttribute(el2,"stroke","none");
          dom.setAttribute(el2,"stroke-width","1");
          dom.setAttribute(el2,"fill","rgb(39,46,48)");
          var el3 = dom.createElement("circle");
          dom.setAttribute(el3,"cx","53");
          dom.setAttribute(el3,"cy","67");
          dom.setAttribute(el3,"r","14");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("circle");
          dom.setAttribute(el3,"cx","116");
          dom.setAttribute(el3,"cy","41");
          dom.setAttribute(el3,"r","12");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("circle");
          dom.setAttribute(el3,"cx","155");
          dom.setAttribute(el3,"cy","99");
          dom.setAttribute(el3,"r","12");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("circle");
          dom.setAttribute(el3,"cx","74");
          dom.setAttribute(el3,"cy","154");
          dom.setAttribute(el3,"r","16");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() { return []; },
        statements: [

        ],
        locals: [],
        templates: []
      };
    }());
    var child1 = (function() {
      var child0 = (function() {
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 22,
                "column": 18
              },
              "end": {
                "line": 26,
                "column": 18
              }
            },
            "moduleName": "cms/templates/application.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("                    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("li");
            dom.setAttribute(el1,"class","cms-dropdown-li");
            var el2 = dom.createTextNode("\n                      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("a");
            dom.setAttribute(el2,"href","#");
            dom.setAttribute(el2,"class","cms cms-dropdown-link");
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n                    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1, 1]);
            var morphs = new Array(2);
            morphs[0] = dom.createElementMorph(element0);
            morphs[1] = dom.createMorphAt(element0,0,0);
            return morphs;
          },
          statements: [
            ["element","action",["newEntry",["get","collection",["loc",[null,[24,84],[24,94]]]]],[],["loc",[null,[24,64],[24,96]]]],
            ["content","collection.label",["loc",[null,[24,97],[24,117]]]]
          ],
          locals: [],
          templates: []
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 21,
              "column": 16
            },
            "end": {
              "line": 27,
              "column": 16
            }
          },
          "moduleName": "cms/templates/application.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["block","if",[["get","collection.create",["loc",[null,[22,24],[22,41]]]]],[],0,null,["loc",[null,[22,18],[26,25]]]]
        ],
        locals: ["collection"],
        templates: [child0]
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 56,
            "column": 0
          }
        },
        "moduleName": "cms/templates/application.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-main");
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","cms cms-navbar-top cms-text");
        var el4 = dom.createTextNode("\n        ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","cms cms-left-menu");
        var el5 = dom.createTextNode("\n          ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","cms-logo");
        var el6 = dom.createTextNode("\n");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("          ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n\n          ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","cms cms-breadcrumb");
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n        ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","cms cms-right-menu");
        var el5 = dom.createTextNode("\n          ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("ul");
        dom.setAttribute(el5,"class","cms cms-inline-list");
        var el6 = dom.createTextNode("\n            ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        dom.setAttribute(el6,"class","cms cms-li cms-has-dropdown");
        var el7 = dom.createTextNode("\n              ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("a");
        dom.setAttribute(el7,"class","cms cms-nav-link");
        dom.setAttribute(el7,"href","#");
        var el8 = dom.createTextNode("\n                ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("i");
        dom.setAttribute(el8,"class","cms cms-icon cms-icon-new");
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n                New\n              ");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n              ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("ul");
        var el8 = dom.createTextNode("\n");
        dom.appendChild(el7, el8);
        var el8 = dom.createComment("");
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("              ");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n            ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n            ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        dom.setAttribute(el6,"class","cms cms-li cms-has-dropdown");
        var el7 = dom.createTextNode("\n              ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("a");
        dom.setAttribute(el7,"class","cms cms-nav-link");
        dom.setAttribute(el7,"href","#");
        var el8 = dom.createTextNode("\n                ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("i");
        dom.setAttribute(el8,"class","cms cms-icon cms-icon-profile");
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n                Profile\n              ");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n              ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("ul");
        var el8 = dom.createTextNode("\n                ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("li");
        dom.setAttribute(el8,"class","cms cms-dropdown-li");
        var el9 = dom.createTextNode("\n                  ");
        dom.appendChild(el8, el9);
        var el9 = dom.createElement("a");
        dom.setAttribute(el9,"href","#");
        dom.setAttribute(el9,"class","cms cms-dropdown-link");
        var el10 = dom.createTextNode("Log out");
        dom.appendChild(el9, el10);
        dom.appendChild(el8, el9);
        var el9 = dom.createTextNode("\n                ");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n            ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n      ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-sidebar cms-text");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"id","cms-global-components");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0]);
        var element2 = dom.childAt(element1, [1]);
        var element3 = dom.childAt(element2, [1]);
        var element4 = dom.childAt(element3, [1]);
        var element5 = dom.childAt(element3, [3, 1]);
        var element6 = dom.childAt(element5, [1]);
        var element7 = dom.childAt(element6, [1]);
        var element8 = dom.childAt(element6, [3]);
        var element9 = dom.childAt(element5, [3]);
        var element10 = dom.childAt(element9, [1]);
        var element11 = dom.childAt(element9, [3]);
        var element12 = dom.childAt(element11, [1, 1]);
        var element13 = dom.childAt(fragment, [4]);
        var morphs = new Array(13);
        morphs[0] = dom.createAttrMorph(element1, 'class');
        morphs[1] = dom.createMorphAt(dom.childAt(element4, [1]),1,1);
        morphs[2] = dom.createMorphAt(dom.childAt(element4, [3]),0,0);
        morphs[3] = dom.createElementMorph(element7);
        morphs[4] = dom.createAttrMorph(element8, 'class');
        morphs[5] = dom.createMorphAt(element8,1,1);
        morphs[6] = dom.createElementMorph(element10);
        morphs[7] = dom.createAttrMorph(element11, 'class');
        morphs[8] = dom.createElementMorph(element12);
        morphs[9] = dom.createMorphAt(element2,3,3);
        morphs[10] = dom.createMorphAt(dom.childAt(element1, [3]),1,1);
        morphs[11] = dom.createAttrMorph(element13, 'class');
        morphs[12] = dom.createMorphAt(element13,1,1);
        return morphs;
      },
      statements: [
        ["attribute","class",["concat",["cms cms-base cms-wrapper ",["subexpr","if",[["get","showSidebar",["loc",[null,[1,42],[1,53]]]],"cms-show-sidebar","cms-hide-sidebar"],[],["loc",[null,[1,37],[1,93]]]]]]],
        ["block","link-to",["index"],[],0,null,["loc",[null,[6,12],[8,24]]]],
        ["content","cms-breadcrumbs",["loc",[null,[11,42],[11,61]]]],
        ["element","action",["toggleCollections"],[],["loc",[null,[16,51],[16,81]]]],
        ["attribute","class",["concat",["cms cms-dropdown ",["subexpr","if",[["get","showCollections",["loc",[null,[20,47],[20,62]]]],"cms-open","cms-closed"],[],["loc",[null,[20,42],[20,88]]]]]]],
        ["block","each",[["get","collections",["loc",[null,[21,24],[21,35]]]]],[],1,null,["loc",[null,[21,16],[27,25]]]],
        ["element","action",["toggleProfile"],[],["loc",[null,[31,51],[31,77]]]],
        ["attribute","class",["concat",["cms cms-dropdown ",["subexpr","if",[["get","showProfile",["loc",[null,[35,47],[35,58]]]],"cms-open","cms-closed"],[],["loc",[null,[35,42],[35,84]]]]]]],
        ["element","action",["logout"],[],["loc",[null,[37,60],[37,79]]]],
        ["content","outlet",["loc",[null,[45,6],[45,16]]]],
        ["inline","outlet",["sidebar"],[],["loc",[null,[48,4],[48,24]]]],
        ["attribute","class",["concat",["cms cms-login-modal ",["subexpr","if",[["get","showLoginModal",["loc",[null,[53,37],[53,51]]]],"cms-open"],[],["loc",[null,[53,32],[53,64]]]]]]],
        ["inline","component",[["get","authenticator",["loc",[null,[54,14],[54,27]]]]],["authorizationError",["subexpr","@mut",[["get","authorizationError",["loc",[null,[54,47],[54,65]]]]],[],[]],"action","login"],["loc",[null,[54,2],[54,82]]]]
      ],
      locals: [],
      templates: [child0, child1]
    };
  }()));

});
define('cms/templates/collection', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 4,
              "column": 4
            },
            "end": {
              "line": 6,
              "column": 4
            }
          },
          "moduleName": "cms/templates/collection.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
          return morphs;
        },
        statements: [
          ["inline","cms-list-entry",[],["entry",["subexpr","@mut",[["get","entry",["loc",[null,[5,29],[5,34]]]]],[],[]]],["loc",[null,[5,6],[5,36]]]]
        ],
        locals: ["entry"],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 9,
            "column": 0
          }
        },
        "moduleName": "cms/templates/collection.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-content cms-list-content");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h2");
        dom.setAttribute(el2,"class","cms cms-list-header cms-text");
        var el3 = dom.createTextNode("All ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(" entries");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        dom.setAttribute(el2,"class","cms cms-list");
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(dom.childAt(element0, [1]),1,1);
        morphs[1] = dom.createMorphAt(dom.childAt(element0, [3]),1,1);
        return morphs;
      },
      statements: [
        ["content","collection.label",["loc",[null,[2,47],[2,67]]]],
        ["block","each",[["get","entries",["loc",[null,[4,12],[4,19]]]]],[],0,null,["loc",[null,[4,4],[6,13]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/cms-authenticators/github-api', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 4,
              "column": 4
            },
            "end": {
              "line": 6,
              "column": 4
            }
          },
          "moduleName": "cms/templates/components/cms-authenticators/github-api.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","cms cms-login-error");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),0,0);
          return morphs;
        },
        statements: [
          ["content","error",["loc",[null,[5,37],[5,46]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    var child1 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 6,
              "column": 4
            },
            "end": {
              "line": 10,
              "column": 4
            }
          },
          "moduleName": "cms/templates/components/cms-authenticators/github-api.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","cms cms-login-message");
          var el2 = dom.createTextNode("\n      Login to your CMS to add or edit content.\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes() { return []; },
        statements: [

        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 17,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-authenticators/github-api.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-container cms-center");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-text cms-message-box");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        dom.setAttribute(el3,"class","cms cms-message-title");
        var el4 = dom.createTextNode("CMS Login");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","#");
        dom.setAttribute(el3,"class","cms cms-login-button");
        var el4 = dom.createTextNode("\n      Login Now\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0, 1]);
        var element1 = dom.childAt(element0, [5]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(element0,3,3);
        morphs[1] = dom.createElementMorph(element1);
        return morphs;
      },
      statements: [
        ["block","if",[["get","error",["loc",[null,[4,10],[4,15]]]]],[],0,1,["loc",[null,[4,4],[10,11]]]],
        ["element","action",["authenticate"],[],["loc",[null,[12,45],[12,70]]]]
      ],
      locals: [],
      templates: [child0, child1]
    };
  }()));

});
define('cms/templates/components/cms-authenticators/netlify-api', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 4,
              "column": 4
            },
            "end": {
              "line": 6,
              "column": 4
            }
          },
          "moduleName": "cms/templates/components/cms-authenticators/netlify-api.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","cms cms-login-error");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),0,0);
          return morphs;
        },
        statements: [
          ["content","error",["loc",[null,[5,37],[5,46]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 24,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-authenticators/netlify-api.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-container cms-center");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-text cms-message-box cms-login");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        dom.setAttribute(el3,"class","cms cms-message-title");
        var el4 = dom.createTextNode("CMS Login");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","cms");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","cms cms-login-control");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("label");
        dom.setAttribute(el5,"class","cms cms-label");
        var el6 = dom.createTextNode("Email");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","cms cms-login-control");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("label");
        dom.setAttribute(el5,"class","cms cms-label");
        var el6 = dom.createTextNode("Password");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","#");
        dom.setAttribute(el3,"class","cms cms-login-button");
        var el4 = dom.createTextNode("\n      Login Now\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0, 1]);
        var element1 = dom.childAt(element0, [5]);
        var element2 = dom.childAt(element0, [7]);
        var morphs = new Array(4);
        morphs[0] = dom.createMorphAt(element0,3,3);
        morphs[1] = dom.createMorphAt(dom.childAt(element1, [1]),3,3);
        morphs[2] = dom.createMorphAt(dom.childAt(element1, [3]),3,3);
        morphs[3] = dom.createElementMorph(element2);
        return morphs;
      },
      statements: [
        ["block","if",[["get","error",["loc",[null,[4,10],[4,15]]]]],[],0,null,["loc",[null,[4,4],[6,11]]]],
        ["inline","input",[],["type","email","class","cms cms-input","value",["subexpr","@mut",[["get","email",["loc",[null,[11,57],[11,62]]]]],[],[]],"placeholder","Your Email"],["loc",[null,[11,8],[11,89]]]],
        ["inline","input",[],["type","password","class","cms cms-input","value",["subexpr","@mut",[["get","password",["loc",[null,[15,60],[15,68]]]]],[],[]],"placeholder","Your Password"],["loc",[null,[15,8],[15,98]]]],
        ["element","action",["authenticate"],[],["loc",[null,[19,45],[19,70]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/cms-authenticators/test-repo', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 16,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-authenticators/test-repo.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-container cms-center");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-text cms-message-box");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("h2");
        dom.setAttribute(el3,"class","cms cms-message-title");
        var el4 = dom.createTextNode("CMS Login");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","cms cms-login-message");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("This is a demo site using your browsers memory to store all content");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("You can login by clicking the button below, and try out the Netliy CMS UI");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("All changes you make will be reset when you refresh your browser.");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"href","#");
        dom.setAttribute(el3,"class","cms cms-login-button");
        var el4 = dom.createTextNode("\n      Login Now\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0, 1, 5]);
        var morphs = new Array(1);
        morphs[0] = dom.createElementMorph(element0);
        return morphs;
      },
      statements: [
        ["element","action",["authenticate"],[],["loc",[null,[11,45],[11,70]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/cms-breadcrumbs', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 4,
                "column": 4
              },
              "end": {
                "line": 4,
                "column": 79
              }
            },
            "moduleName": "cms/templates/components/cms-breadcrumbs.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createElement("span");
            dom.setAttribute(el1,"class","cms cms-breadcrumb-separator");
            var el2 = dom.createTextNode(" / ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() { return []; },
          statements: [

          ],
          locals: [],
          templates: []
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 2
            },
            "end": {
              "line": 5,
              "column": 2
            }
          },
          "moduleName": "cms/templates/components/cms-breadcrumbs.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("a");
          dom.setAttribute(el1,"href","#");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(4);
          morphs[0] = dom.createAttrMorph(element0, 'class');
          morphs[1] = dom.createElementMorph(element0);
          morphs[2] = dom.createMorphAt(element0,0,0);
          morphs[3] = dom.createMorphAt(fragment,3,3,contextualElement);
          return morphs;
        },
        statements: [
          ["attribute","class",["concat",["cms cms-breadcrumb ",["get","crumb.class",["loc",[null,[3,73],[3,84]]]]]]],
          ["element","action",["gotoCrumb",["get","crumb",["loc",[null,[3,37],[3,42]]]]],[],["loc",[null,[3,16],[3,44]]]],
          ["content","crumb.label",["loc",[null,[3,88],[3,103]]]],
          ["block","unless",[["get","crumb.last",["loc",[null,[4,14],[4,24]]]]],[],0,null,["loc",[null,[4,4],[4,90]]]]
        ],
        locals: ["crumb"],
        templates: [child0]
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 7,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-breadcrumbs.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-breadcrumbs");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]),1,1);
        return morphs;
      },
      statements: [
        ["block","each",[["get","breadcrumbs",["loc",[null,[2,10],[2,21]]]]],[],0,null,["loc",[null,[2,2],[5,11]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/cms-entry-form', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-entry-form.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["content","yield",["loc",[null,[1,0],[1,9]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/cms-list-entry', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 2
            },
            "end": {
              "line": 7,
              "column": 2
            }
          },
          "moduleName": "cms/templates/components/cms-list-entry.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("h3");
          dom.setAttribute(el1,"class","cms cms-entry-title");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","cms cms-entry-excerpt");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(2);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),0,0);
          morphs[1] = dom.createMorphAt(dom.childAt(fragment, [3]),1,1);
          return morphs;
        },
        statements: [
          ["content","entry.cmsTitle",["loc",[null,[3,36],[3,54]]]],
          ["content","entry.cmsExcerpt",["loc",[null,[5,6],[5,26]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 9,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-list-entry.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("li");
        dom.setAttribute(el1,"class","cms cms-list-entry");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]),1,1);
        return morphs;
      },
      statements: [
        ["block","link-to",["edit",["get","entry",["loc",[null,[2,20],[2,25]]]]],["class","cms cms-list-entry-link"],0,null,["loc",[null,[2,2],[7,14]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/cms-markdown-editor', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 4,
              "column": 2
            },
            "end": {
              "line": 22,
              "column": 2
            }
          },
          "moduleName": "cms/templates/components/cms-markdown-editor.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"class","cms cms-toolbar-button");
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","cms cms-icon cms-icon-h1");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"class","cms cms-toolbar-button");
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","cms cms-icon cms-icon-h2");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"class","cms cms-toolbar-button");
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","cms cms-icon cms-icon-h3");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"class","cms cms-toolbar-button");
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","cms cms-icon cms-icon-bold");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"class","cms cms-toolbar-button");
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","cms cms-icon cms-icon-italic");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var element1 = dom.childAt(element0, [1]);
          var element2 = dom.childAt(element0, [3]);
          var element3 = dom.childAt(element0, [5]);
          var element4 = dom.childAt(element0, [7]);
          var element5 = dom.childAt(element0, [9]);
          var morphs = new Array(7);
          morphs[0] = dom.createAttrMorph(element0, 'class');
          morphs[1] = dom.createAttrMorph(element0, 'style');
          morphs[2] = dom.createElementMorph(element1);
          morphs[3] = dom.createElementMorph(element2);
          morphs[4] = dom.createElementMorph(element3);
          morphs[5] = dom.createElementMorph(element4);
          morphs[6] = dom.createElementMorph(element5);
          return morphs;
        },
        statements: [
          ["attribute","class",["concat",["cms cms-markdown-toolbar ",["subexpr","if",[["get","toolbarOpen",["loc",[null,[5,46],[5,57]]]],"cms-open"],[],["loc",[null,[5,41],[5,70]]]]]]],
          ["attribute","style",["concat",["top: ",["get","toolbarY",["loc",[null,[5,86],[5,94]]]],"px; left: ",["get","toolbarX",["loc",[null,[5,108],[5,116]]]],"px"]]],
          ["element","action",["h1"],["on","mouseDown"],["loc",[null,[6,40],[6,70]]]],
          ["element","action",["h2"],["on","mouseDown"],["loc",[null,[9,40],[9,70]]]],
          ["element","action",["h3"],["on","mouseDown"],["loc",[null,[12,40],[12,70]]]],
          ["element","action",["bold"],["on","mouseDown"],["loc",[null,[15,40],[15,72]]]],
          ["element","action",["italic"],["on","mouseDown"],["loc",[null,[18,40],[18,74]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 24,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-markdown-editor.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-markdown-editor");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element6 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(element6,1,1);
        morphs[1] = dom.createMorphAt(element6,3,3);
        return morphs;
      },
      statements: [
        ["inline","cms-expanding-textarea",[],["value",["subexpr","@mut",[["get","value",["loc",[null,[2,33],[2,38]]]]],[],[]]],["loc",[null,[2,2],[2,40]]]],
        ["block","ember-wormhole",[],["to","cms-global-components"],0,null,["loc",[null,[4,2],[22,21]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/cms-preview-pane', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-preview-pane.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","partial",[["get","previewTemplate",["loc",[null,[1,10],[1,25]]]]],[],["loc",[null,[1,0],[1,27]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/cms-preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            meta: {
              "revision": "Ember@2.0.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 3,
                  "column": 4
                },
                "end": {
                  "line": 3,
                  "column": 50
                }
              },
              "moduleName": "cms/templates/components/cms-preview.hbs"
            },
            arity: 1,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, 0);
              dom.insertBoundary(fragment, null);
              return morphs;
            },
            statements: [
              ["inline","yield",[["get","item",["loc",[null,[3,44],[3,48]]]]],[],["loc",[null,[3,36],[3,50]]]]
            ],
            locals: ["item"],
            templates: []
          };
        }());
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 4,
                "column": 2
              }
            },
            "moduleName": "cms/templates/components/cms-preview.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
            return morphs;
          },
          statements: [
            ["block","each",[["get","widget.items",["loc",[null,[3,12],[3,24]]]]],[],0,null,["loc",[null,[3,4],[3,59]]]]
          ],
          locals: [],
          templates: [child0]
        };
      }());
      var child1 = (function() {
        var child0 = (function() {
          return {
            meta: {
              "revision": "Ember@2.0.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 5,
                  "column": 4
                },
                "end": {
                  "line": 7,
                  "column": 4
                }
              },
              "moduleName": "cms/templates/components/cms-preview.hbs"
            },
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("      ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
              return morphs;
            },
            statements: [
              ["inline","yield",[["get","widget.item",["loc",[null,[6,14],[6,25]]]]],[],["loc",[null,[6,6],[6,27]]]]
            ],
            locals: [],
            templates: []
          };
        }());
        var child1 = (function() {
          return {
            meta: {
              "revision": "Ember@2.0.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 7,
                  "column": 4
                },
                "end": {
                  "line": 9,
                  "column": 4
                }
              },
              "moduleName": "cms/templates/components/cms-preview.hbs"
            },
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("      ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
              return morphs;
            },
            statements: [
              ["inline","yield",[["get","entry",["loc",[null,[8,14],[8,19]]]]],[],["loc",[null,[8,6],[8,21]]]]
            ],
            locals: [],
            templates: []
          };
        }());
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 4,
                "column": 2
              },
              "end": {
                "line": 10,
                "column": 2
              }
            },
            "moduleName": "cms/templates/components/cms-preview.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, 0);
            dom.insertBoundary(fragment, null);
            return morphs;
          },
          statements: [
            ["block","if",[["get","widget.item",["loc",[null,[5,10],[5,21]]]]],[],0,1,["loc",[null,[5,4],[9,11]]]]
          ],
          locals: [],
          templates: [child0, child1]
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 11,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/cms-preview.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["block","if",[["get","widget.items",["loc",[null,[2,8],[2,20]]]]],[],0,1,["loc",[null,[2,2],[10,9]]]]
        ],
        locals: [],
        templates: [child0, child1]
      };
    }());
    var child1 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 11,
              "column": 0
            },
            "end": {
              "line": 13,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/cms-preview.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          return morphs;
        },
        statements: [
          ["inline","cms-widget",[],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[12,20],[12,26]]]]],[],[]],"type","preview"],["loc",[null,[12,0],[12,43]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 14,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["block","if",[["get","hasBlock",["loc",[null,[1,6],[1,14]]]]],[],0,1,["loc",[null,[1,0],[13,7]]]]
      ],
      locals: [],
      templates: [child0, child1]
    };
  }()));

});
define('cms/templates/components/cms-sortable-list', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 5,
                "column": 6
              },
              "end": {
                "line": 5,
                "column": 61
              }
            },
            "moduleName": "cms/templates/components/cms-sortable-list.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","cms cms-icon-drag");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes() { return []; },
          statements: [

          ],
          locals: [],
          templates: []
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 12,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/cms-sortable-list.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("li");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"class","cms cms-collapse-control cms-icon-marker");
          dom.setAttribute(el2,"href","#");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","cms cms-item-container");
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","cms cms-list-actions");
          var el4 = dom.createTextNode("\n        ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("a");
          dom.setAttribute(el4,"href","#");
          dom.setAttribute(el4,"class","cms cms-list-icon cms-icon-remove");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n      ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n    ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var element1 = dom.childAt(element0, [1]);
          var element2 = dom.childAt(element0, [3]);
          var element3 = dom.childAt(element2, [5, 1]);
          var morphs = new Array(6);
          morphs[0] = dom.createAttrMorph(element0, 'class');
          morphs[1] = dom.createAttrMorph(element0, 'data-item');
          morphs[2] = dom.createElementMorph(element1);
          morphs[3] = dom.createMorphAt(element2,1,1);
          morphs[4] = dom.createMorphAt(element2,3,3);
          morphs[5] = dom.createElementMorph(element3);
          return morphs;
        },
        statements: [
          ["attribute","class",["concat",["cms cms-list-item ",["subexpr","if",[["get","item.item.cmsCollapsed",["loc",[null,[2,36],[2,58]]]],"cms-collapsed"],[],["loc",[null,[2,31],[2,76]]]]]]],
          ["attribute","data-item",["concat",[["get","item.id",["loc",[null,[2,91],[2,98]]]]]]],
          ["element","action",["toggleCollapse",["get","item",["loc",[null,[3,91],[3,95]]]]],[],["loc",[null,[3,65],[3,97]]]],
          ["block","if",[["get","draggable",["loc",[null,[5,12],[5,21]]]]],[],0,null,["loc",[null,[5,6],[5,68]]]],
          ["inline","yield",[["get","item.item",["loc",[null,[6,14],[6,23]]]]],[],["loc",[null,[6,6],[6,25]]]],
          ["element","action",["removeItem",["get","item",["loc",[null,[8,84],[8,88]]]]],[],["loc",[null,[8,62],[8,90]]]]
        ],
        locals: ["item"],
        templates: [child0]
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 13,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/cms-sortable-list.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["block","each",[["get","sortableItems",["loc",[null,[1,8],[1,21]]]]],[],0,null,["loc",[null,[1,0],[12,9]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widget', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 3,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widget.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
          return morphs;
        },
        statements: [
          ["inline","component",[["get","controlComponent",["loc",[null,[2,14],[2,30]]]]],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[2,38],[2,44]]]]],[],[]],"tagName",""],["loc",[null,[2,2],[2,57]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    var child1 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 3,
              "column": 0
            },
            "end": {
              "line": 5,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widget.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
          return morphs;
        },
        statements: [
          ["inline","component",[["get","previewComponent",["loc",[null,[4,14],[4,30]]]]],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[4,38],[4,44]]]]],[],[]],"tagName",["subexpr","@mut",[["get","previewTagName",["loc",[null,[4,53],[4,67]]]]],[],[]],"classNames",["subexpr","@mut",[["get","previewClassNames",["loc",[null,[4,79],[4,96]]]]],[],[]]],["loc",[null,[4,2],[4,98]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 6,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widget.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["block","if",[["get","isControl",["loc",[null,[1,6],[1,15]]]]],[],0,1,["loc",[null,[1,0],[5,7]]]]
      ],
      locals: [],
      templates: [child0, child1]
    };
  }()));

});
define('cms/templates/components/widgets/checkbox_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/checkbox_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("label");
        dom.setAttribute(el1,"class","cms cms-checkbox-label");
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(element0,0,0);
        morphs[1] = dom.createMorphAt(element0,2,2);
        return morphs;
      },
      statements: [
        ["inline","input",[],["type","checkbox","checked",["subexpr","@mut",[["get","widget.value",["loc",[null,[1,70],[1,82]]]]],[],[]]],["loc",[null,[1,38],[1,84]]]],
        ["content","widget.label",["loc",[null,[1,85],[1,101]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/checkbox_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 1,
              "column": 36
            }
          },
          "moduleName": "cms/templates/components/widgets/checkbox_preview.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["content","widget.label",["loc",[null,[1,20],[1,36]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    var child1 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 36
            },
            "end": {
              "line": 1,
              "column": 64
            }
          },
          "moduleName": "cms/templates/components/widgets/checkbox_preview.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Not ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["content","widget.label",["loc",[null,[1,48],[1,64]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 1,
            "column": 71
          }
        },
        "moduleName": "cms/templates/components/widgets/checkbox_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["block","if",[["get","widget.value",["loc",[null,[1,6],[1,18]]]]],[],0,1,["loc",[null,[1,0],[1,71]]]]
      ],
      locals: [],
      templates: [child0, child1]
    };
  }()));

});
define('cms/templates/components/widgets/date_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/date_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","cms-date-input",[],["value",["subexpr","@mut",[["get","value",["loc",[null,[1,23],[1,28]]]]],[],[]]],["loc",[null,[1,0],[1,30]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/date_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/date_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","time-format",[["get","widget.value",["loc",[null,[1,14],[1,26]]]],"LL"],[],["loc",[null,[1,0],[1,33]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/datetime_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 5,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/datetime_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-datetime");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(element0,1,1);
        morphs[1] = dom.createMorphAt(element0,3,3);
        return morphs;
      },
      statements: [
        ["inline","cms-date-input",[],["value",["subexpr","@mut",[["get","date",["loc",[null,[2,25],[2,29]]]]],[],[]],"class","cms cms-datetime-date"],["loc",[null,[2,2],[2,61]]]],
        ["inline","cms-time-input",[],["value",["subexpr","@mut",[["get","time",["loc",[null,[3,25],[3,29]]]]],[],[]],"class","cms cms-datetime-time"],["loc",[null,[3,2],[3,61]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/datetime_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/datetime_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","time-format",[["get","widget.value",["loc",[null,[1,14],[1,26]]]],"LLLL"],[],["loc",[null,[1,0],[1,35]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/files_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 0
              },
              "end": {
                "line": 7,
                "column": 0
              }
            },
            "moduleName": "cms/templates/components/widgets/files_control.hbs"
          },
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("  ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","cms cms-file");
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("label");
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n  ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1]);
            var morphs = new Array(2);
            morphs[0] = dom.createMorphAt(dom.childAt(element0, [1]),0,0);
            morphs[1] = dom.createMorphAt(element0,3,3);
            return morphs;
          },
          statements: [
            ["content","file.path",["loc",[null,[4,11],[4,24]]]],
            ["inline","input",[],["value",["subexpr","@mut",[["get","file.label",["loc",[null,[5,18],[5,28]]]]],[],[]]],["loc",[null,[5,4],[5,30]]]]
          ],
          locals: ["file"],
          templates: []
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 8,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widgets/files_control.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["block","cms-sortable-list",[],["items",["subexpr","@mut",[["get","widget.value",["loc",[null,[2,27],[2,39]]]]],[],[]],"action","reorder","id","path"],0,null,["loc",[null,[2,0],[7,22]]]]
        ],
        locals: [],
        templates: [child0]
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 14,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/files_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-upload-dropzone");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("strong");
        var el3 = dom.createTextNode("Drop files");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" to upload");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("br");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  (or click)\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        morphs[1] = dom.createMorphAt(dom.childAt(fragment, [1]),5,5);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["block","if",[["get","widget.value.length",["loc",[null,[1,6],[1,25]]]]],[],0,null,["loc",[null,[1,0],[8,7]]]],
        ["inline","cms-file-field",[],["value",["subexpr","@mut",[["get","uploads",["loc",[null,[12,25],[12,32]]]]],[],[]],"multiple",true,"accept",["subexpr","@mut",[["get","accept",["loc",[null,[12,54],[12,60]]]]],[],[]],"action","fileUpload"],["loc",[null,[12,2],[12,82]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widgets/files_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 0
            },
            "end": {
              "line": 4,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widgets/files_preview.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createElement("li");
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"href","#");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0, 0]),0,0);
          return morphs;
        },
        statements: [
          ["content","file.label",["loc",[null,[3,16],[3,30]]]]
        ],
        locals: ["file"],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 6,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/files_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("ul");
        dom.setAttribute(el1,"class","cms-files-preview");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]),1,1);
        return morphs;
      },
      statements: [
        ["block","each",[["get","widget.value",["loc",[null,[2,8],[2,20]]]]],[],0,null,["loc",[null,[2,0],[4,9]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widgets/hidden_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 1,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/hidden_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() { return []; },
      statements: [

      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/hidden_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 1,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/hidden_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() { return []; },
      statements: [

      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/image_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 5,
              "column": 0
            },
            "end": {
              "line": 10,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widgets/image_control.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","cms cms-upload-value");
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("span");
          dom.setAttribute(el2,"class","cms cms-text");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"class","cms-icon cms-icon-remove");
          dom.setAttribute(el2,"href","#");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [0]);
          var element1 = dom.childAt(element0, [3]);
          var morphs = new Array(2);
          morphs[0] = dom.createMorphAt(dom.childAt(element0, [1]),0,0);
          morphs[1] = dom.createElementMorph(element1);
          return morphs;
        },
        statements: [
          ["content","widget.value",["loc",[null,[7,29],[7,45]]]],
          ["element","action",["clear"],[],["loc",[null,[8,47],[8,65]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 11,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/image_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-upload-dropzone");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("strong");
        dom.setAttribute(el2,"class","cms cms-text");
        var el3 = dom.createTextNode("Add ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(" ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3,"class","cms-icon cms-icon-edit");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element2 = dom.childAt(fragment, [0]);
        var morphs = new Array(3);
        morphs[0] = dom.createMorphAt(dom.childAt(element2, [1]),1,1);
        morphs[1] = dom.createMorphAt(element2,3,3);
        morphs[2] = dom.createMorphAt(fragment,2,2,contextualElement);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["content","widget.label",["loc",[null,[2,35],[2,51]]]],
        ["inline","cms-file-field",[],["value",["subexpr","@mut",[["get","uploads",["loc",[null,[3,25],[3,32]]]]],[],[]],"multiple",false,"accept","image/jpeg,image/gif,image/png,image/svg+xml","action","fileUpload"],["loc",[null,[3,2],[3,124]]]],
        ["block","if",[["get","widget.value",["loc",[null,[5,6],[5,18]]]]],[],0,null,["loc",[null,[5,0],[10,7]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widgets/image_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 3,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widgets/image_preview.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createElement("img");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [0]);
          var morphs = new Array(1);
          morphs[0] = dom.createAttrMorph(element0, 'src');
          return morphs;
        },
        statements: [
          ["attribute","src",["concat",[["get","widget.src",["loc",[null,[2,12],[2,22]]]]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 4,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/image_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["block","if",[["get","widget.src",["loc",[null,[1,6],[1,16]]]]],[],0,null,["loc",[null,[1,0],[3,7]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widgets/list_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 2,
                "column": 2
              },
              "end": {
                "line": 9,
                "column": 2
              }
            },
            "moduleName": "cms/templates/components/widgets/list_control.hbs"
          },
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","cms cms-widget");
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","cms cms-control");
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("label");
            dom.setAttribute(el3,"class","cms cms-label cms-text");
            var el4 = dom.createComment("");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n      ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n    ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1, 1]);
            var morphs = new Array(2);
            morphs[0] = dom.createMorphAt(dom.childAt(element0, [1]),0,0);
            morphs[1] = dom.createMorphAt(element0,3,3);
            return morphs;
          },
          statements: [
            ["inline","if",[["get","item.cmsCollapsed",["loc",[null,[5,51],[5,68]]]],["get","item.cmsFirstField",["loc",[null,[5,69],[5,87]]]],["get","widget.label",["loc",[null,[5,88],[5,100]]]]],[],["loc",[null,[5,46],[5,102]]]],
            ["inline","cms-widget",[],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[6,28],[6,34]]]]],[],[]],"type","control"],["loc",[null,[6,8],[6,51]]]]
          ],
          locals: ["widget"],
          templates: []
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 10,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widgets/list_control.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["block","each",[["get","item.widgets",["loc",[null,[2,10],[2,22]]]]],[],0,null,["loc",[null,[2,2],[9,11]]]]
        ],
        locals: ["item"],
        templates: [child0]
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 16,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/list_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-list-controls cms-text");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("a");
        dom.setAttribute(el2,"href","#");
        dom.setAttribute(el2,"class","cms cms-new-link");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("i");
        dom.setAttribute(el3,"class","cms cms-icon-create");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(" New\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [1, 1]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        morphs[1] = dom.createElementMorph(element1);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["block","cms-sortable-list",[],["items",["subexpr","@mut",[["get","widget.items",["loc",[null,[1,27],[1,39]]]]],[],[]],"action","reorder"],0,null,["loc",[null,[1,0],[10,22]]]],
        ["element","action",["addItem"],[],["loc",[null,[12,39],[12,59]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widgets/list_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 4,
                "column": 2
              },
              "end": {
                "line": 6,
                "column": 2
              }
            },
            "moduleName": "cms/templates/components/widgets/list_preview.hbs"
          },
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("    ");
            dom.appendChild(el0, el1);
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
            return morphs;
          },
          statements: [
            ["inline","cms-widget",[],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[5,24],[5,30]]]]],[],[]],"type","preview"],["loc",[null,[5,4],[5,47]]]]
          ],
          locals: ["widget"],
          templates: []
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 0
            },
            "end": {
              "line": 8,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widgets/list_preview.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("li");
          dom.setAttribute(el1,"class","cms-list-item-preview widget");
          var el2 = dom.createTextNode("\n");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),1,1);
          return morphs;
        },
        statements: [
          ["block","each",[["get","item.widgets",["loc",[null,[4,10],[4,22]]]]],[],0,null,["loc",[null,[4,2],[6,11]]]]
        ],
        locals: ["item"],
        templates: [child0]
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 10,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/list_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("ul");
        dom.setAttribute(el1,"class","cms-list-preview");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]),1,1);
        return morphs;
      },
      statements: [
        ["block","each",[["get","widget.items",["loc",[null,[2,8],[2,20]]]]],[],0,null,["loc",[null,[2,0],[8,9]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widgets/markdown_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/markdown_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","cms-markdown-editor",[],["label",["subexpr","@mut",[["get","widget.label",["loc",[null,[1,28],[1,40]]]]],[],[]],"value",["subexpr","@mut",[["get","widget.value",["loc",[null,[1,47],[1,59]]]]],[],[]],"mediaFolder",["subexpr","@mut",[["get","widget.mediaFolder",["loc",[null,[1,72],[1,90]]]]],[],[]]],["loc",[null,[1,0],[1,92]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/not-found-control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 3,
            "column": 93
          }
        },
        "moduleName": "cms/templates/components/widgets/not-found-control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("label");
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("p");
        dom.setAttribute(el1,"class","cms-warn");
        var el2 = dom.createTextNode("No control component for \"");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\" widgets");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("p");
        dom.setAttribute(el1,"class","cms-warn");
        var el2 = dom.createTextNode("Add a template called \"cms/components/widgets/");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("-control");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(3);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]),0,0);
        morphs[1] = dom.createMorphAt(dom.childAt(fragment, [2]),1,1);
        morphs[2] = dom.createMorphAt(dom.childAt(fragment, [4]),1,1);
        return morphs;
      },
      statements: [
        ["content","widget.label",["loc",[null,[1,7],[1,23]]]],
        ["content","widget.type",["loc",[null,[2,46],[2,61]]]],
        ["content","widget.type",["loc",[null,[3,66],[3,81]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/number_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/number_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","input",[],["value",["subexpr","@mut",[["get","value",["loc",[null,[1,14],[1,19]]]]],[],[]],"type","number"],["loc",[null,[1,0],[1,35]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/object_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 4,
              "column": 4
            },
            "end": {
              "line": 11,
              "column": 4
            }
          },
          "moduleName": "cms/templates/components/widgets/object_control.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","cms cms-widget");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","cms cms-control");
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("label");
          dom.setAttribute(el3,"class","cms cms-label cms-text");
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1, 1]);
          var morphs = new Array(2);
          morphs[0] = dom.createMorphAt(dom.childAt(element0, [1]),0,0);
          morphs[1] = dom.createMorphAt(element0,3,3);
          return morphs;
        },
        statements: [
          ["inline","if",[["get","collapsed",["loc",[null,[7,53],[7,62]]]],["get","item.cmsFirstField",["loc",[null,[7,63],[7,81]]]],["get","widget.label",["loc",[null,[7,82],[7,94]]]]],[],["loc",[null,[7,48],[7,96]]]],
          ["inline","cms-widget",[],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[8,30],[8,36]]]]],[],[]],"type","control"],["loc",[null,[8,10],[8,53]]]]
        ],
        locals: ["widget"],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 14,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/object_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("a");
        dom.setAttribute(el2,"class","cms cms-collapse-control cms-icon-marker");
        dom.setAttribute(el2,"href","#");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-item-container");
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0]);
        var element2 = dom.childAt(element1, [1]);
        var morphs = new Array(4);
        morphs[0] = dom.createAttrMorph(element1, 'class');
        morphs[1] = dom.createAttrMorph(element1, 'data-item');
        morphs[2] = dom.createElementMorph(element2);
        morphs[3] = dom.createMorphAt(dom.childAt(element1, [3]),1,1);
        return morphs;
      },
      statements: [
        ["attribute","class",["concat",["cms cms-list-item ",["subexpr","if",[["get","collapsed",["loc",[null,[1,35],[1,44]]]],"cms-collapsed"],[],["loc",[null,[1,30],[1,62]]]]]]],
        ["attribute","data-item",["concat",[["get","item.id",["loc",[null,[1,77],[1,84]]]]]]],
        ["element","action",["toggleCollapse",["get","item",["loc",[null,[2,89],[2,93]]]]],[],["loc",[null,[2,63],[2,95]]]],
        ["block","each",[["get","item.widgets",["loc",[null,[4,12],[4,24]]]]],[],0,null,["loc",[null,[4,4],[11,13]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widgets/object_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 3,
              "column": 0
            }
          },
          "moduleName": "cms/templates/components/widgets/object_preview.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
          return morphs;
        },
        statements: [
          ["inline","cms-widget",[],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[2,22],[2,28]]]]],[],[]],"type","preview"],["loc",[null,[2,2],[2,45]]]]
        ],
        locals: ["widget"],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 4,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/object_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["block","each",[["get","widget.item.widgets",["loc",[null,[1,8],[1,27]]]]],[],0,null,["loc",[null,[1,0],[3,9]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/components/widgets/slug_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/slug_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","input",[],["value",["subexpr","@mut",[["get","slug",["loc",[null,[1,14],[1,18]]]]],[],[]]],["loc",[null,[1,0],[1,20]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/string_control', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/components/widgets/string_control.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","input",[],["value",["subexpr","@mut",[["get","widget.value",["loc",[null,[1,14],[1,26]]]]],[],[]]],["loc",[null,[1,0],[1,28]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/components/widgets/string_preview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 1,
            "column": 16
          }
        },
        "moduleName": "cms/templates/components/widgets/string_preview.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["content","widget.value",["loc",[null,[1,0],[1,16]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/dashboard', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 4,
            "column": 0
          }
        },
        "moduleName": "cms/templates/dashboard.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("What do we show on the dashboard?");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() { return []; },
      statements: [

      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/entry-sidebar', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 6,
                "column": 4
              },
              "end": {
                "line": 13,
                "column": 4
              }
            },
            "moduleName": "cms/templates/entry-sidebar.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("      ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("div");
            dom.setAttribute(el1,"class","cms cms-meta");
            var el2 = dom.createTextNode("\n        ");
            dom.appendChild(el1, el2);
            var el2 = dom.createElement("div");
            dom.setAttribute(el2,"class","cms cms-meta-control");
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            var el3 = dom.createElement("label");
            dom.setAttribute(el3,"class","cms cms-label");
            var el4 = dom.createComment("");
            dom.appendChild(el3, el4);
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n          ");
            dom.appendChild(el2, el3);
            var el3 = dom.createComment("");
            dom.appendChild(el2, el3);
            var el3 = dom.createTextNode("\n        ");
            dom.appendChild(el2, el3);
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("\n      ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element1 = dom.childAt(fragment, [1, 1]);
            var morphs = new Array(2);
            morphs[0] = dom.createMorphAt(dom.childAt(element1, [1]),0,0);
            morphs[1] = dom.createMorphAt(element1,3,3);
            return morphs;
          },
          statements: [
            ["content","widget.label",["loc",[null,[9,39],[9,55]]]],
            ["inline","cms-widget",[],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[10,30],[10,36]]]]],[],[]],"type","control"],["loc",[null,[10,10],[10,53]]]]
          ],
          locals: [],
          templates: []
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 5,
              "column": 2
            },
            "end": {
              "line": 14,
              "column": 2
            }
          },
          "moduleName": "cms/templates/entry-sidebar.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["block","unless",[["get","widget.hidden",["loc",[null,[6,14],[6,27]]]]],[],0,null,["loc",[null,[6,4],[13,15]]]]
        ],
        locals: ["widget"],
        templates: [child0]
      };
    }());
    var child1 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 18,
              "column": 4
            },
            "end": {
              "line": 23,
              "column": 4
            }
          },
          "moduleName": "cms/templates/entry-sidebar.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("a");
          dom.setAttribute(el1,"class","cms cms-action cms-btn-delete");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("i");
          dom.setAttribute(el2,"class","cms cms-icon cms-icon-remove");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      Delete\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1]);
          var morphs = new Array(1);
          morphs[0] = dom.createElementMorph(element0);
          return morphs;
        },
        statements: [
          ["element","action",["delete"],[],["loc",[null,[19,7],[19,26]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 26,
            "column": 0
          }
        },
        "moduleName": "cms/templates/entry-sidebar.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-sidebar-top");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h3");
        dom.setAttribute(el2,"class","cms cms-sidebar-title");
        var el3 = dom.createTextNode("Entry Settings");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-sidebar-content");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-sidebar-bottom");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-sidebar-actions");
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [2]),1,1);
        morphs[1] = dom.createMorphAt(dom.childAt(fragment, [4, 1]),1,1);
        return morphs;
      },
      statements: [
        ["block","each",[["get","meta",["loc",[null,[5,10],[5,14]]]]],[],0,null,["loc",[null,[5,2],[14,11]]]],
        ["block","if",[["get","canDelete",["loc",[null,[18,10],[18,19]]]]],[],1,null,["loc",[null,[18,4],[23,11]]]]
      ],
      locals: [],
      templates: [child0, child1]
    };
  }()));

});
define('cms/templates/entry', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            meta: {
              "revision": "Ember@2.0.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 4,
                  "column": 6
                },
                "end": {
                  "line": 11,
                  "column": 6
                }
              },
              "moduleName": "cms/templates/entry.hbs"
            },
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("        ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("div");
              dom.setAttribute(el1,"class","cms cms-widget");
              var el2 = dom.createTextNode("\n          ");
              dom.appendChild(el1, el2);
              var el2 = dom.createElement("div");
              dom.setAttribute(el2,"class","cms cms-control");
              var el3 = dom.createTextNode("\n            ");
              dom.appendChild(el2, el3);
              var el3 = dom.createElement("label");
              dom.setAttribute(el3,"class","cms cms-label cms-text");
              var el4 = dom.createComment("");
              dom.appendChild(el3, el4);
              dom.appendChild(el2, el3);
              var el3 = dom.createTextNode("\n            ");
              dom.appendChild(el2, el3);
              var el3 = dom.createComment("");
              dom.appendChild(el2, el3);
              var el3 = dom.createTextNode("\n          ");
              dom.appendChild(el2, el3);
              dom.appendChild(el1, el2);
              var el2 = dom.createTextNode("\n        ");
              dom.appendChild(el1, el2);
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var element1 = dom.childAt(fragment, [1, 1]);
              var morphs = new Array(2);
              morphs[0] = dom.createMorphAt(dom.childAt(element1, [1]),0,0);
              morphs[1] = dom.createMorphAt(element1,3,3);
              return morphs;
            },
            statements: [
              ["content","widget.label",["loc",[null,[7,50],[7,66]]]],
              ["inline","cms-widget",[],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[8,32],[8,38]]]]],[],[]],"type","control"],["loc",[null,[8,12],[8,55]]]]
            ],
            locals: [],
            templates: []
          };
        }());
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 3,
                "column": 4
              },
              "end": {
                "line": 12,
                "column": 4
              }
            },
            "moduleName": "cms/templates/entry.hbs"
          },
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createComment("");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
            dom.insertBoundary(fragment, 0);
            dom.insertBoundary(fragment, null);
            return morphs;
          },
          statements: [
            ["block","unless",[["get","widget.hidden",["loc",[null,[4,16],[4,29]]]]],[],0,null,["loc",[null,[4,6],[11,17]]]]
          ],
          locals: ["widget"],
          templates: [child0]
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 2,
              "column": 2
            },
            "end": {
              "line": 13,
              "column": 2
            }
          },
          "moduleName": "cms/templates/entry.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["block","each",[["get","widgets",["loc",[null,[3,12],[3,19]]]]],[],0,null,["loc",[null,[3,4],[12,13]]]]
        ],
        locals: [],
        templates: [child0]
      };
    }());
    var child1 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 21,
              "column": 4
            },
            "end": {
              "line": 23,
              "column": 4
            }
          },
          "moduleName": "cms/templates/entry.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1,"class","cms-message");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),0,0);
          return morphs;
        },
        statements: [
          ["content","error",["loc",[null,[22,32],[22,41]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    var child2 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            meta: {
              "revision": "Ember@2.0.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 26,
                  "column": 10
                },
                "end": {
                  "line": 28,
                  "column": 10
                }
              },
              "moduleName": "cms/templates/entry.hbs"
            },
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("            ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
              return morphs;
            },
            statements: [
              ["content","errorMessage",["loc",[null,[27,12],[27,28]]]]
            ],
            locals: [],
            templates: []
          };
        }());
        var child1 = (function() {
          return {
            meta: {
              "revision": "Ember@2.0.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 28,
                  "column": 10
                },
                "end": {
                  "line": 30,
                  "column": 10
                }
              },
              "moduleName": "cms/templates/entry.hbs"
            },
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("            Can't save until all fields have been filled out correctly.\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes() { return []; },
            statements: [

            ],
            locals: [],
            templates: []
          };
        }());
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 24,
                "column": 6
              },
              "end": {
                "line": 32,
                "column": 6
              }
            },
            "moduleName": "cms/templates/entry.hbs"
          },
          arity: 0,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("        ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("span");
            dom.setAttribute(el1,"class","cms-message");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("        ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var morphs = new Array(1);
            morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),1,1);
            return morphs;
          },
          statements: [
            ["block","if",[["get","errorMessage",["loc",[null,[26,17],[26,29]]]]],[],0,1,["loc",[null,[26,10],[30,17]]]]
          ],
          locals: [],
          templates: [child0, child1]
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 23,
              "column": 4
            },
            "end": {
              "line": 33,
              "column": 4
            }
          },
          "moduleName": "cms/templates/entry.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
          dom.insertBoundary(fragment, 0);
          dom.insertBoundary(fragment, null);
          return morphs;
        },
        statements: [
          ["block","if",[["get","isInvalid",["loc",[null,[24,12],[24,21]]]]],[],0,null,["loc",[null,[24,6],[32,13]]]]
        ],
        locals: [],
        templates: [child0]
      };
    }());
    var child3 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 43,
              "column": 6
            },
            "end": {
              "line": 50,
              "column": 6
            }
          },
          "moduleName": "cms/templates/entry.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("li");
          dom.setAttribute(el1,"class","cms cms-li");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("a");
          dom.setAttribute(el2,"class","cms-link cms-settings-btn");
          dom.setAttribute(el2,"href","#");
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("i");
          dom.setAttribute(el3,"class","cms cms-icon cms-icon-gear");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          Settings\n        ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1, 1]);
          var morphs = new Array(1);
          morphs[0] = dom.createElementMorph(element0);
          return morphs;
        },
        statements: [
          ["element","action",["toggleSidebar"],[],["loc",[null,[45,54],[45,80]]]]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 54,
            "column": 0
          }
        },
        "moduleName": "cms/templates/entry.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-content cms-entry-editor");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-navbar-bottom cms-text");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","cms cms-loading-indicator-inner");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-left-menu");
        var el3 = dom.createTextNode("\n");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-right-menu");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("ul");
        dom.setAttribute(el3,"class","cms cms-inline-list");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("li");
        dom.setAttribute(el4,"class","cms cms-li");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"class","cms-link cms-save-btn");
        dom.setAttribute(el5,"href","#");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("i");
        dom.setAttribute(el6,"class","cms cms-icon cms-icon-update");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element2 = dom.childAt(fragment, [0]);
        var element3 = dom.childAt(fragment, [2]);
        var element4 = dom.childAt(element3, [1]);
        var element5 = dom.childAt(element3, [5, 1]);
        var element6 = dom.childAt(element5, [1, 1]);
        var morphs = new Array(7);
        morphs[0] = dom.createMorphAt(element2,1,1);
        morphs[1] = dom.createMorphAt(element2,3,3);
        morphs[2] = dom.createAttrMorph(element4, 'class');
        morphs[3] = dom.createMorphAt(dom.childAt(element3, [3]),1,1);
        morphs[4] = dom.createElementMorph(element6);
        morphs[5] = dom.createMorphAt(element6,3,3);
        morphs[6] = dom.createMorphAt(element5,3,3);
        return morphs;
      },
      statements: [
        ["block","cms-entry-form",[],["action","save"],0,null,["loc",[null,[2,2],[13,21]]]],
        ["inline","cms-preview-pane",[],["entry",["subexpr","@mut",[["get","entry",["loc",[null,[14,27],[14,32]]]]],[],[]],"collection",["subexpr","@mut",[["get","collection",["loc",[null,[14,44],[14,54]]]]],[],[]],"widgets",["subexpr","@mut",[["get","widgets",["loc",[null,[14,63],[14,70]]]]],[],[]]],["loc",[null,[14,2],[14,72]]]],
        ["attribute","class",["concat",["cms cms-loading-indicator ",["subexpr","if",[["get","saving",["loc",[null,[17,45],[17,51]]]],"cms-loading"],[],["loc",[null,[17,40],[17,67]]]]]]],
        ["block","if",[["get","error",["loc",[null,[21,10],[21,15]]]]],[],1,2,["loc",[null,[21,4],[33,11]]]],
        ["element","action",["save"],[],["loc",[null,[38,50],[38,67]]]],
        ["inline","if",[["get","saving",["loc",[null,[40,15],[40,21]]]],"Saving...","Save"],[],["loc",[null,[40,10],[40,42]]]],
        ["block","if",[["get","meta.length",["loc",[null,[43,12],[43,23]]]]],[],3,null,["loc",[null,[43,6],[50,13]]]]
      ],
      locals: [],
      templates: [child0, child1, child2, child3]
    };
  }()));

});
define('cms/templates/index', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      var child0 = (function() {
        var child0 = (function() {
          return {
            meta: {
              "revision": "Ember@2.0.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 8,
                  "column": 14
                },
                "end": {
                  "line": 11,
                  "column": 14
                }
              },
              "moduleName": "cms/templates/index.hbs"
            },
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createTextNode("                ");
              dom.appendChild(el0, el1);
              var el1 = dom.createElement("i");
              dom.setAttribute(el1,"class","cms cms-icon cms-icon-selector");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n                ");
              dom.appendChild(el0, el1);
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              var el1 = dom.createTextNode("\n");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,3,3,contextualElement);
              return morphs;
            },
            statements: [
              ["content","collection.label",["loc",[null,[10,16],[10,36]]]]
            ],
            locals: [],
            templates: []
          };
        }());
        var child1 = (function() {
          var child0 = (function() {
            return {
              meta: {
                "revision": "Ember@2.0.1",
                "loc": {
                  "source": null,
                  "start": {
                    "line": 13,
                    "column": 16
                  },
                  "end": {
                    "line": 15,
                    "column": 16
                  }
                },
                "moduleName": "cms/templates/index.hbs"
              },
              arity: 0,
              cachedFragment: null,
              hasRendered: false,
              buildFragment: function buildFragment(dom) {
                var el0 = dom.createDocumentFragment();
                var el1 = dom.createTextNode("                  ");
                dom.appendChild(el0, el1);
                var el1 = dom.createElement("i");
                dom.setAttribute(el1,"class","cms cms-icon-create");
                dom.appendChild(el0, el1);
                var el1 = dom.createTextNode(" New\n");
                dom.appendChild(el0, el1);
                return el0;
              },
              buildRenderNodes: function buildRenderNodes() { return []; },
              statements: [

              ],
              locals: [],
              templates: []
            };
          }());
          return {
            meta: {
              "revision": "Ember@2.0.1",
              "loc": {
                "source": null,
                "start": {
                  "line": 12,
                  "column": 14
                },
                "end": {
                  "line": 16,
                  "column": 14
                }
              },
              "moduleName": "cms/templates/index.hbs"
            },
            arity: 0,
            cachedFragment: null,
            hasRendered: false,
            buildFragment: function buildFragment(dom) {
              var el0 = dom.createDocumentFragment();
              var el1 = dom.createComment("");
              dom.appendChild(el0, el1);
              return el0;
            },
            buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
              var morphs = new Array(1);
              morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
              dom.insertBoundary(fragment, 0);
              dom.insertBoundary(fragment, null);
              return morphs;
            },
            statements: [
              ["block","link-to",["create",["get","collection",["loc",[null,[13,36],[13,46]]]]],["class","cms cms-aside-new-link"],0,null,["loc",[null,[13,16],[15,28]]]]
            ],
            locals: [],
            templates: [child0]
          };
        }());
        return {
          meta: {
            "revision": "Ember@2.0.1",
            "loc": {
              "source": null,
              "start": {
                "line": 6,
                "column": 10
              },
              "end": {
                "line": 18,
                "column": 10
              }
            },
            "moduleName": "cms/templates/index.hbs"
          },
          arity: 1,
          cachedFragment: null,
          hasRendered: false,
          buildFragment: function buildFragment(dom) {
            var el0 = dom.createDocumentFragment();
            var el1 = dom.createTextNode("            ");
            dom.appendChild(el0, el1);
            var el1 = dom.createElement("li");
            dom.setAttribute(el1,"class","cms cms-collection");
            var el2 = dom.createTextNode("\n");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createComment("");
            dom.appendChild(el1, el2);
            var el2 = dom.createTextNode("            ");
            dom.appendChild(el1, el2);
            dom.appendChild(el0, el1);
            var el1 = dom.createTextNode("\n");
            dom.appendChild(el0, el1);
            return el0;
          },
          buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
            var element0 = dom.childAt(fragment, [1]);
            var morphs = new Array(2);
            morphs[0] = dom.createMorphAt(element0,1,1);
            morphs[1] = dom.createMorphAt(element0,2,2);
            return morphs;
          },
          statements: [
            ["block","link-to",["index.list",["get","collection",["loc",[null,[8,38],[8,48]]]]],["class","cms cms-aside-link"],0,null,["loc",[null,[8,14],[11,26]]]],
            ["block","if",[["get","collection.create",["loc",[null,[12,20],[12,37]]]]],[],1,null,["loc",[null,[12,14],[16,21]]]]
          ],
          locals: ["collection"],
          templates: [child0, child1]
        };
      }());
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 4,
              "column": 6
            },
            "end": {
              "line": 20,
              "column": 6
            }
          },
          "moduleName": "cms/templates/index.hbs"
        },
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("ul");
          dom.setAttribute(el1,"class","cms cms-nav-menu");
          var el2 = dom.createTextNode("\n");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("        ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),1,1);
          return morphs;
        },
        statements: [
          ["block","each",[["get","collections",["loc",[null,[6,18],[6,29]]]]],[],0,null,["loc",[null,[6,10],[18,19]]]]
        ],
        locals: [],
        templates: [child0]
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 25,
            "column": 0
          }
        },
        "moduleName": "cms/templates/index.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","cms cms-content");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","cms cms-container");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","cms cms-aside cms-text");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0, 1]);
        var morphs = new Array(2);
        morphs[0] = dom.createMorphAt(dom.childAt(element1, [1]),1,1);
        morphs[1] = dom.createMorphAt(element1,3,3);
        return morphs;
      },
      statements: [
        ["block","if",[["get","collections",["loc",[null,[4,12],[4,23]]]]],[],0,null,["loc",[null,[4,6],[20,13]]]],
        ["content","outlet",["loc",[null,[22,4],[22,14]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/templates/login', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 2,
            "column": 0
          }
        },
        "moduleName": "cms/templates/login.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        return morphs;
      },
      statements: [
        ["inline","component",[["get","authenticator",["loc",[null,[1,12],[1,25]]]]],["authorizationError",["subexpr","@mut",[["get","authorizationError",["loc",[null,[1,45],[1,63]]]]],[],[]],"action","login"],["loc",[null,[1,0],[1,80]]]]
      ],
      locals: [],
      templates: []
    };
  }()));

});
define('cms/templates/preview/default', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.0.1",
          "loc": {
            "source": null,
            "start": {
              "line": 1,
              "column": 0
            },
            "end": {
              "line": 5,
              "column": 0
            }
          },
          "moduleName": "cms/templates/preview/default.hbs"
        },
        arity: 1,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","cms cms-preview");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var morphs = new Array(1);
          morphs[0] = dom.createMorphAt(dom.childAt(fragment, [1]),1,1);
          return morphs;
        },
        statements: [
          ["inline","cms-widget",[],["widget",["subexpr","@mut",[["get","widget",["loc",[null,[3,24],[3,30]]]]],[],[]],"type","preview"],["loc",[null,[3,4],[3,47]]]]
        ],
        locals: ["widget"],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.0.1",
        "loc": {
          "source": null,
          "start": {
            "line": 1,
            "column": 0
          },
          "end": {
            "line": 6,
            "column": 0
          }
        },
        "moduleName": "cms/templates/preview/default.hbs"
      },
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        dom.insertBoundary(fragment, null);
        return morphs;
      },
      statements: [
        ["block","each",[["get","widgets",["loc",[null,[1,8],[1,15]]]]],[],0,null,["loc",[null,[1,0],[5,9]]]]
      ],
      locals: [],
      templates: [child0]
    };
  }()));

});
define('cms/utils/markdown_vdom', ['exports', 'npm:commonmark', 'npm:virtual-dom/vnode/vnode', 'npm:virtual-dom/vnode/vtext'], function (exports, commonmark, VNode, VText) {

  'use strict';

  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  var getAttrs = {};
  ['class', 'style', 'allowfullscreen', 'allowtransparency', 'charset', 'cols', 'contextmenu', 'datetime', 'disabled', 'form', 'frameborder', 'height', 'hidden', 'maxlength', 'role', 'rows', 'seamless', 'size', 'width', 'wmode', 'cx', 'cy', 'd', 'dx', 'dy', 'fill', 'fx', 'fy', 'gradientTransform', 'gradientUnits', 'offset', 'points', 'r', 'rx', 'ry', 'spreadMethod', 'stopColor', 'stopOpacity', 'stroke', 'strokeLinecap', 'strokeWidth', 'textAnchor', 'transform', 'version', 'viewBox', 'x1', 'x2', 'x', 'y1', 'y2', 'y'].forEach(function (attr) {
    getAttrs[attr] = true;
  });

  /*
    Lookup table to convert from Markdown nodes to VDOM nodes
  */
  var nodeTypes = {
    Paragraph: 'p',
    Item: 'li',
    BlockQuote: 'blockquote',
    Link: 'a',
    Emph: 'em',
    Strong: 'strong',
    Hardbreak: 'br',
    HorizontalRule: 'hr'
  };

  /*
    Handler used with HTMLParser to convert HTML to VDOM
  */

  var HTMLHandler = (function () {
    function HTMLHandler(media) {
      _classCallCheck(this, HTMLHandler);

      this.media = media;
      this.stack = [{ tagName: 'none', children: [] }];
      this.current = this.stack[0];
    }

    _createClass(HTMLHandler, [{
      key: 'start',
      value: function start(tagName, attrs, unary) {
        this.stack.push({ tagName: tagName, properties: this.propertiesFor(tagName, attrs), children: [] });
        this.current = this.stack[this.stack.length - 1];
        if (unary) {
          this.end(tagName);
        }
      }
    }, {
      key: 'end',
      value: function end(tagName) {
        var newNode = new VNode['default'](this.current.tagName, this.current.properties, this.current.children);
        this.stack.pop();
        this.current = this.stack[this.stack.length - 1];
        if (tagName === 'script') {
          return;
        }
        this.current.children.push(newNode);
      }
    }, {
      key: 'chars',
      value: function chars(text) {
        this.current.children.push(new VText['default'](text));
      }
    }, {
      key: 'propertiesFor',
      value: function propertiesFor(tagName, attrs) {
        var _this = this;

        var properties = {};
        var value;
        attrs.forEach(function (attr) {
          value = (attr.value || '').indexOf('javascript:') === 0 ? '' : attr.value;
          if (getAttrs[attr.name]) {
            properties.attributes = properties.attributes || {};
            properties.attributes[attr.name] = value;
          } else if (attr.name.indexOf('on') === 0) {} else if (attr.name === 'src') {
            properties.src = _this.media.srcFor(value);
          } else {
            properties[attr.name] = value;
          }
        });
        if (tagName === 'a') {
          properties.target = '_blank';
        }
        return properties;
      }
    }, {
      key: 'getNodes',
      value: function getNodes() {
        return this.current.children;
      }
    }], [{
      key: 'htmlToVDOM',

      /*
        We need the global media store so we can handle image sources for uploaded
        images.
      */
      value: function htmlToVDOM(html, media) {
        var handler = new HTMLHandler(media);

        try {
          new HTMLParser(html, handler);
        } catch (_) {
          return [new VText['default'](html)];
        }

        return handler.getNodes();
      }
    }]);

    return HTMLHandler;
  })();

  /*
    MarkdownProcessor - Converts a Markdown string to a virtual DOM.
  */

  var MarkdownProcessor = (function () {
    function MarkdownProcessor(media) {
      _classCallCheck(this, MarkdownProcessor);

      this.media = media;
      this.markdownParser = new commonmark['default'].Parser();
    }

    _createClass(MarkdownProcessor, [{
      key: 'markdownToVDOM',
      value: function markdownToVDOM(markdown) {
        var _this2 = this;

        var event, entering, node, newNode, html, grandparent;
        var ast = this.markdownParser.parse(markdown || '');
        var walker = ast.walker();
        var stack = [{ tagName: 'div', properties: {}, children: [] }];
        var current = stack[0];

        while (event = walker.next()) {
          entering = event.entering;
          node = event.node;
          switch (node.type) {
            case 'Text':
              current.children.push(new VText['default'](node.literal));
              break;
            case 'Softbreak':
              current.children.push(new VText['default']('\n'));
              break;
            case 'Hardbreak':
            case 'HorizontalRule':
              current.children.push(new VNode['default'](this.tagNameFor(node), {}, []));
              break;
            case 'Emph':
            case 'Strong':
            case 'BlockQuote':
            case 'Item':
            case 'List':
            case 'Link':
            case 'Header':
            case 'Paragraph':
              if (node.type === 'Paragraph') {
                grandparent = node.parent.parent;
                if (grandparent !== null && grandparent.type === 'List') {
                  if (grandparent.listTight) {
                    break;
                  }
                }
              }
              if (entering) {
                stack.push({ tagName: this.tagNameFor(node), properties: this.propertiesFor(node), children: [] });
                current = stack[stack.length - 1];
              } else {
                if (current.html) {
                  var newChildren = [];
                  html = '';
                  current.children.forEach(function (child) {
                    if (child.type === 'VirtualText') {
                      html += child.text;
                    } else {
                      HTMLHandler.htmlToVDOM(html, _this2.media).forEach(function (node) {
                        newChildren.push(node);
                      });
                      html = '';
                      newChildren.push(child);
                    }
                  });
                  HTMLHandler.htmlToVDOM(html, this.media).forEach(function (node) {
                    newChildren.push(node);
                  });
                  current.children = newChildren;
                }
                newNode = new VNode['default'](current.tagName, current.properties, current.children);
                stack.pop();
                current = stack[stack.length - 1];
                current.children.push(newNode);
              }
              break;
            case 'Image':
              if (entering) {
                stack.push({ tagName: 'img', properties: this.propertiesFor(node), children: [] });
                current = stack[stack.length - 1];
              } else {
                if (current.children.length) {
                  current.properties.alt = '';
                  current.children.forEach(function (child) {
                    current.properties.alt += child.text || '';
                  });
                }
                newNode = new VNode['default'](current.tagName, current.properties, []);
                stack.pop();
                current = stack[stack.length - 1];
                current.children.push(newNode);
              }
              break;
            case 'Code':
              current.children.push(new VNode['default']('code', {}, [new VText['default'](node.literal)]));
              break;
            case 'CodeBlock':
              current.children.push(new VNode['default']('pre', {}, [new VNode['default']('code', this.propertiesFor(node), [new VText['default'](node.literal)])]));
              break;
            case 'Html':
              current.html = true;
              current.children.push(new VText['default'](node.literal));
              break;
            case 'HtmlBlock':
              HTMLHandler.htmlToVDOM(node.literal, this.media).forEach(function (node) {
                current.children.push(node);
              });
              break;
            default:
            // Do nothing
          }
        }

        return new VNode['default'](current.tagName, current.properties, current.children);
      }
    }, {
      key: 'tagNameFor',
      value: function tagNameFor(node) {
        switch (node.type) {
          case 'Header':
            return 'h' + node.level;
          case 'List':
            return node.listType === 'Bullet' ? 'ul' : 'ol';
          default:
            return nodeTypes[node.type];
        }
      }
    }, {
      key: 'propertiesFor',
      value: function propertiesFor(node) {
        var infoWords;
        var properties = {};
        switch (node.type) {
          case 'Link':
            properties.href = node.destination;
            properties.target = '_blank';
            if (node.title) {
              properties.title = node.title;
            }
            break;
          case 'Image':
            properties.src = this.media.srcFor(node.destination);
            break;
          case 'CodeBlock':
            infoWords = node.info ? node.info.split(/ +/) : [];
            if (infoWords.length > 0 && infoWords[0].length > 0) {
              properties.attributes = { 'class': 'language-' + infoWords[0] };
            }
            break;
          default:
            break;
        }
        return properties;
      }
    }]);

    return MarkdownProcessor;
  })();

  exports['default'] = MarkdownProcessor;

  // Skip

});
define('cms/utils/sanitizer', ['exports'], function (exports) {

  'use strict';

  var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; }

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  /* global HTMLParser */

  /**
  @module app
  @submodule utils
  */

  /* Helpers for transforming messy pasted in HTML to clean Markup */
  var selfClosing = {
    img: true,
    hr: true,
    br: true
  };

  var whitespace = /^\s*$/;

  var Node = (function () {
    function Node(node) {
      _classCallCheck(this, Node);

      this.node = node;
    }

    _createClass(Node, [{
      key: 'render',
      value: function render() {
        var text = (this.node.text || '').replace(/\n/g, '').replace(/(&nbsp;)+/g, ' ');
        return text.replace(/\s+/g, ' ');
      }
    }]);

    return Node;
  })();

  var Root = (function (_Node) {
    function Root() {
      _classCallCheck(this, Root);

      if (_Node != null) {
        _Node.apply(this, arguments);
      }
    }

    _inherits(Root, _Node);

    _createClass(Root, [{
      key: 'render',
      value: function render() {
        var result = '';
        for (var i = 0, len = this.node.children.length; i < len; i++) {
          result += this.node.children[i].render();
        }
        return result;
      }
    }]);

    return Root;
  })(Node);

  var Tag = (function (_Root) {
    function Tag() {
      _classCallCheck(this, Tag);

      if (_Root != null) {
        _Root.apply(this, arguments);
      }
    }

    _inherits(Tag, _Root);

    _createClass(Tag, [{
      key: 'render',
      value: function render() {
        var innerHTML = _get(Object.getPrototypeOf(Tag.prototype), 'render', this).call(this);
        if (!selfClosing[this.node.tagName] && whitespace.test(innerHTML)) {
          return innerHTML.replace(/\s+/, ' ');
        }
        switch (this.node.tagName) {
          case 'strong':
          case 'b':
            return '**' + innerHTML.trim() + '**';
          case 'em':
          case 'i':
            return '_' + innerHTML.trim() + '_';
          case 'a':
            return '[' + innerHTML.trim().replace(/\s+/, ' ') + '](' + this.node.attrs.href + ')';
          case 'img':
            return '![' + (this.node.attrs.alt || '') + '](' + this.node.attrs.src + ')';
          case 'hr':
            return '\n\n--------\n\n';
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            return '' + this.headerPrefix(this.node.tagName) + ' ' + innerHTML.replace(/\s+/, ' ').trim() + '\n\n';
          case 'div':
            return '' + innerHTML + '\n\n';
          case 'p':
            return '' + innerHTML + '\n\n';
          case 'li':
            return '* ' + innerHTML + '\n';
          case 'br':
            return '  \n';
        }
        return innerHTML;
      }
    }, {
      key: 'headerPrefix',
      value: function headerPrefix(tagName) {
        var count = parseInt(tagName.substr(1), 10);
        var prefix = '';
        for (var i = 0; i < count; i++) {
          prefix += '#';
        }
        return prefix;
      }
    }]);

    return Tag;
  })(Root);

  var HTMLHandler = (function () {
    function HTMLHandler() {
      _classCallCheck(this, HTMLHandler);

      this.stack = [{ tagName: 'html', children: [] }];
      this.current = this.stack[0];
    }

    _createClass(HTMLHandler, [{
      key: 'start',
      value: function start(tagName, attrs, unary) {
        this.stack.push({ tagName: tagName, attrs: this.attrsFor(attrs), children: [] });
        this.current = this.stack[this.stack.length - 1];
        if (unary) {
          this.end(tagName);
        }
      }
    }, {
      key: 'end',
      value: function end() {
        var newNode = new Tag(this.current);
        this.stack.pop();
        this.current = this.stack[this.stack.length - 1];
        this.current.children.push(newNode);
      }
    }, {
      key: 'chars',
      value: function chars(text) {

        this.current.children.push(new Node({ text: text }));
      }
    }, {
      key: 'attrsFor',
      value: function attrsFor(attrs) {
        var obj = {};
        attrs.forEach(function (attr) {
          obj[attr.name] = attr.value;
        });
        return obj;
      }
    }, {
      key: 'getText',
      value: function getText() {
        return new Root(this.current).render().replace(/\n\n\n+/g, '\n\n');
      }
    }]);

    return HTMLHandler;
  })();

  /**
    An HTML Sanitizer and Markdown converter.

    Will parse HTML and turn it into basic markdown with no inline-HTML blocks.

    Handles strong/b, em/i, links, lists, headings, images, hrs, paragraphs and line breaks.

    @class Sanitizer
  */

  var Sanitizer = (function () {
    function Sanitizer() {
      _classCallCheck(this, Sanitizer);
    }

    _createClass(Sanitizer, [{
      key: 'sanitize',

      /**
        Takes an HTML string and returns a sanitized markdown string.
         @method sanitize
        @param {String} html
        @return {String} Returns a markdown string
      */
      value: function sanitize(html) {
        var handler = new HTMLHandler();
        try {
          new HTMLParser(html, handler);
        } catch (e) {
          console.log('Error cleaning HTML: %o', e);
          return html;
        }

        return handler.getText();
      }
    }]);

    return Sanitizer;
  })();

  exports['default'] = Sanitizer;

});
define('cms/utils/slugify', ['exports'], function (exports) {

  'use strict';

  exports.slugify = slugify;
  exports.urlify = urlify;

  function slugify(text) {
    return text.toString().toLowerCase().replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
  }

  function urlify(pathSegment) {
    return pathSegment.toString().toLowerCase().replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\.\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
  }

});
/* jshint ignore:start */

/* jshint ignore:end */

/* jshint ignore:start */

define('cms/config/environment', ['ember'], function(Ember) {
  var prefix = 'cms';
/* jshint ignore:start */

try {
  var metaName = prefix + '/config/environment';
  var rawConfig = Ember['default'].$('meta[name="' + metaName + '"]').attr('content');
  var config = JSON.parse(unescape(rawConfig));

  return { 'default': config };
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

/* jshint ignore:end */

});

if (runningTests) {
  require("cms/tests/test-helper");
} else {
  require("cms/app")["default"].create({"name":"cms","version":"0.0.0.221befb6"});
}

/* jshint ignore:end */
