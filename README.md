# cycle-hmr

> :fire: **Hot** reloading of [cycle.js](http://http://cycle.js.org) 
dataflows without need of *restarting* your app.

### Demo (editing cyclic component's DOM vtree) 

![ezgif com-resize 1](https://cloud.githubusercontent.com/assets/736697/15092621/7ae38b00-1488-11e6-8e61-46d384c6192d.gif)

##  What does it give to me and why I want to use it?

You can edit code of your components and **immediately have last saved version 
injected into the running application** without loosing state. 
It will just improves your dev workflow feedback loop and save your time. Well, it is :fire: hot reloading - **you must use it**!

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


## What do I need to use it?
* Well first you need to use **cycle.js**. Always. If you still don't.
* Have a great desire to **be more efficient** with your development workflow, 
HMR is about quick feedback loop while dev process, **you should use it** (did I say it before?).
* Use [webpack](https://webpack.github.io/) or [browserify](http://browserify.org/) 
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

### 1) Install from npm  
```
npm install cycle-hmr --save-dev
```

Also may need to install adapters, but usually they are installed with your cycle `run` modules (like `@cycle/xstream-run`)
```
npm install @cycle/rxjs-adapter @cycle/xstream-adapter --save
```

### 2) Configure babel plugin

`cycle-hmr` comes with **babel plugin** (as dependency).

You should include the babel plugin (in  `.babelrc`) and 
**point where files with cyclic dataflows** are located using **`include`** option
(you may **also/instead use `exclude` option** to point files that should not be processed), like this:

.babelrc:
```json
{
  "env": {
    "development": {
      "plugins": [
        ["cycle-hmr", {
          "include": "**/cycles/**"      
        }]
      ]
    }
  }
}
```

You want to use some `env` setting because you probably need `cycle-hmr` only in `development` mode.

Note also that `include/exclude` is [glob matchers](https://github.com/isaacs/minimatch) and
**not relative paths** or regexps. This also to files that are processed by babel transpiler, 
so no need to include extension.  

If you don't use `include/exclude` options, no modules will be processed by default.
But you can **include files individually** supplying them with comment on the top:
```js
/* @cycle-hmr */
```
 To **exclude individual files** from processing, use comment on the top:
```js
/* @no-cycle-hmr */
```
#### Why do I need to point to dataflow files and why babel plugin is needed at all?
As it was said to work `cycle-hmr` need have your dataflow functions wrapped with
special proxy. You could do it manually actually: 
```js
 import {hmrProxy} from 'cycle-hrm'
 ...
 // you should also provide hmrProxy with globally unique ID  
 // wich must be preserved between module reloads
 let proxied = hmrProxy(MyDataflowComponent, module.id + 'MyDataflowComponent')
 
 export proxied as MyDataflowComponent
```
 but it is probably not the case, and you won't do this in normal development workflow. 

That is why we use babel plugin, it will statically analyze your code and wrap needed dataflows with proxy.
And as long as **cycle dataflows are just pure JS functions** 
(they are not components classes that extend some basic class like for example in React) 
it is **difficult (or impossible?) to automagically detect and extract cycle dataflows** 
from the code, 
at least until we have some special marks/flags/decorators for them.
So for now we choose a strategy just to wrap all the exports assuming they are (can be) dataflows.
 
Specifically babel plugin for each processed module (file) 
*wraps* all the *export declarations*
with transparent proxy that enables hot replacement of the exported functions 
(and as you understand we need to proxy only exported dataflows). 
It also utilities also `hot.accept()` webpack/browserify HMR API to work with those bundlers. 

*Note: if it proxies something that it should not, well, unlikely 
that it will break anything - HMR proxy wrapper is transparent for non-cyclic exports.
But it is recommended to **have only dataflow exports in processed modules**.
*

#### Additional plugin usage options:

- use specific stream library plugin: `"cycle-hmr/xstream"` 
(to avoid issues with not installed stream adapters).

- **filter exports names** which will be proxied with babel plugin 
  parameter `testExportName`

```json
{
  "development": {
    "plugins": [
      ["cycle-hmr/xstream", {
        "testExportName": "^[A-Z]",
        "include": "*"      
      }]
    ]
  }
}
```

this will process all the files, but will proxy **only named exports starting with capital letter** 
(not it will not include `default` exports in this case, to include them you would use 
`^([A-Z]|default)` regExp expression).


### 3) Configure bundler/loader for hot-reloading

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
    new webpack.IgnorePlugin(/most-adapter/) // for adapters not installed
  ],
  devServer: {
    hot: true,
  ...
```

**NB!** If you use CLI to run WDS (`webpack-dev-server` with `--hot` and `--inline` options) and have 
issues when dealing with compile and runtime errors 
(for example webpack HMR does recover after such errors or reloads the page) recommendation is to use node API for launching WDS:

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

### 4) Turn on debug output if needed

If there is something wrong and you don't understand what (for example HMR does not work), 
you may want to turn on the debug output: It will show what happens to components that are proxied.

Fo this add `proxy.debug` option to `cycle-hmr` babel plugin:
```json
{
  "plugins": [
    ["cycle-hmr", {
      "include": "**/cycles/**",
      "proxy": {
        "debug": "info"
      }
    }]
  ]
}
```
This will turn on debug output for all modules, but you can turn on it
individually using the comment on the top of the module:
```js
 /* @cycle-hmr-debug */
 ```

## Licence
MIT.
