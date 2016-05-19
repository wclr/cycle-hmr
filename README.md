# cycle-hmr

> :fire: **Hot** reloading of [cycle.js](http://http://cycle.js.org) 
dataflows without need of *restarting* your app.

### Demo (editing cyclic component's DOM vtree) 

![ezgif com-resize 1](https://cloud.githubusercontent.com/assets/736697/15092621/7ae38b00-1488-11e6-8e61-46d384c6192d.gif)

##  How does it work?

**cycle-hmr** utilizes "standard" HMR approach - replacing internals 
of existing instances with newly updated versions on the fly. 
It is achieved by proxying cycle components (like it is done for example in [React Hot Reloader](https://github.com/gaearon/react-proxy/)).
In cycle.js application components are pure functions that output sink streams, 
that makes it quite straightforward to transparently and safely extend them. 
When updated version of module with cyclic functions arrives (using some hot reload technique) 
we **replace components while their runtime** 
keeping the rest application parts not touched 
(though of course injection of updated components potentially my cause some "unexpected" effects).


## What do you need to use it?
* Well first you need to use **cycle.js**. Always. If you still don't.
* Have a great desire to **be more efficient** with your development workflow, 
HMR is about quick feedback loop while dev process, **you should use it**.
* Use [webpack](https://webpack.github.io/) or [broserify](http://browserify.org/) 
for modules loading/bundling. 
Other loaders (e.g [System.js](https://github.com/systemjs/systemjs)) 
are not tested and not supported yet.
* Use ES2015 compatible modules, only ES6's `export`s are currently suported. 
`CJS` modules will be ignored.
* Use [babel](babeljs.io) transpiler. If you do't use babel 
for ES2015 => ES5 transformation you can still use it, just for `cycle-hmr` plugin. 
* Understand that it is **experimental feature** and bugs are possible.

## Supported stream libraries

`cycle-hmr` is stream library agnostic. So you can use it with any library supported by `cyclejs` 
([rx4](https://github.com/Reactive-Extensions/RxJS), 
[rx5](https://github.com/ReactiveX/rxjs), 
[most](https://github.com/cujojs/most), [xstream](https://github.com/staltz/xstream)) - 
it **will detect and use needed stream adapter, but you should
 have it installed** in your dependencies, if cycle-hmr will not find valid adapter 
 it will just not proxy your streams. 

## Usage

#### 1) Install from npm  
```
npm install cycle-hmr --save-dev
```

Also my need to install adapters, but usually they are installed with your cycle `run` modules (like `@cycle/xstream-run`)
```
npm install @cycle/rxjs-adapter @cycle/xstream-adapter --save
```

#### 2) Configure babel plugin and point to dataflow files

`cycle-hmr` comes with **babel plugin** (as dependency).

You should include the babel plugin (for example in  `.babelrc`) and 
**point where files** with cyclic dataflows are located (you may also `exclude` option to point files that should not be processed):

.babelrc:
```json
{
  "env": {
    "development": {
      "plugins": [
        ["cycle-hmr", {
          "include": "**/cycles/**.js"      
        }]
      ]
    }
  }
}
```

You can also use only specific stream library plugin: `"cycle-hmr/xstream"`

```json
"development": {
  "plugins": [
    ["cycle-hmr/xstream", {
      "include": "*"      
    }]
  ]
}
```

Note that `include/exclude` is a [glob matchers](https://github.com/isaacs/minimatch) - 
not relative paths, or regexps. If you don't use `include/exclude` options, no modules will be processed by default.
But you can **mark files individually** with comment on the top:
 ```js
 /* @cycle-hmr */
 ```

For each processed module `cycle-hmr` babel plugin *wraps* all the exports 
with (safe) HMR proxy and adds also `hot.accept()` (webpack/browserify HMR API),
so no dependants of the module will be reloaded when module changes. 

*Note: if it proxies something that it should not, well, unlikely 
that it will break anything - HMR proxy wrapper is transparent for non-cyclic exports.*

*NB!* if you have non cycle exports in processed modules, and use them somewhere,
changes to those exports will not have any effect - so it is recommended 
to **have only cyclic exports in processed modules** .

Also you may filter exports names which will be proxied with babel plugin 
parameter `testExportName`, for example such config:
```json
{
  "plugins": [
    ["cycle-hmr", {
      "testExportName": "^[A-Z]"
      "include": "*"      
    }]
  ]
}
```
will process all the files, but will proxy only named exports starting with capital letter 
(not it will not include `default` exports in this case, to include them you would use 
`^([A-Z]|default)` regExp expression).

#### 3) Configure bundler/loader for hot-reloading

It is easy to use cycle-hmr with **webpack** or **browserify**.

####  Webpack
Setup you hot reloading workflow with `webpack-dev-server` and `babel-loader` 
using this need parts of config:
```js
  ...
  entry: [
    'webpack-dev-server/client?http://localhost:' + process.env.PORT,
    'webpack/hot/only-dev-server',
    './app.js' // your app's entry
  ]
  module: {
    loaders: [{
      test: /\.js$/,
      loader: 'babel' // .babelrc should plug in `cycle-hmr`
    }]
  },
  plugins: [
    new webpack.NoErrorsPlugin(), // use it
    new webpack.HotModuleReplacementPlugin(),
    new webpack.IgnorePlugin(/most-adapter/) // for adaperts not installed
  ],
  devServer: {
    hot: true,
  ...
```

**NB!** To have less problems when dealing with compile and runtime errors, 
because of existing issues with `webpack-dev-server` recommendation is to run 
it using node API, instead of cli (especially avoid `--hot` and `--inline` options).

```js
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('./webpack.config');
new WebpackDevServer(webpack(config), config.devServer)
  .listen(process.env.PORT);
```

#### Browserify

Use `browserify-hmr` plugin and `babelify`. Use `--ingnore-missing` option to ignore missing dependencies.
For example launch with [budo](https://github.com/mattdesl/budo) server:

```bash
budo entry.js -- -t babelify --ignore-missing -p browserify-hmr
```

#### 4) Turn on debug output if needed

If there is something wrong and you don't understand what (for example HMR does not work), 
you may want to turn on the debug output: It will show what happens to components that are proxied.

Fo this add `proxy.debug` option to `cycle-hmr` babel plugin:
```json
"plugins": [
  ["cycle-hmr", {
    "include": "**/cycles/**.js",
    "proxy": {
      "debug": "info"
    }
  }]
]
```
This will turn on debug output for all modules, but you can turn on it
individually using the comment on the top of the module:
```js
 /* @cycle-hmr-debug */
 ```

## Licence
MIT.