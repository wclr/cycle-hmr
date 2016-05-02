# cycle-hmr

Hot replacement of [cycle.js](http://http://cycle.js.org) function within 
your application, without need of reinitializing/restarting the app.

##  How does it work?

It is achieved by proxying cycle components (like it is done for example in [React Hot Reloader](https://github.com/gaearon/react-proxy/)).
In cycle we have just pure functions that output sink streams, 
and it is quite straightforward to have them proxied. 
When new module (cycle function) version - we just subscribe proxied sinks to new ones.

## Supported stream libraries

`cycle-hmr` is stream library agnostic. So you can use it with any library supported by `cyclejs` 
(rxjs4, rxjs5, most, xstream) - it will use needed cycle adapter, but you should
 have it installed in your dependencies, if cycle-hmr will not find valid adapter 
 it will just not proxy your streams. 

## Conventions 
To work with `cycle-hmr` you should follow a few convetions:

* have certain locations were modules with cyclic functions are located

* those modules should be exporting only cycle functions for reuse 
*modules with cycle functions (processed with `cycle-hmr` plugin) are supposed 
to be reloaded by its own and will cause dependants to be reloaded, so you are unlikely to see hot reloaded 
changes made to non-cyclic exports*
 

## Usage

```
npm install cycle-hmr --save-dev
```

`cycle-hmr` comes with **babel plugin** (as dependency).

You should include the babel plugin (for example in  `.babelrc`) and point where files with cyclic functions 
are located (you may also `exclude` option to point files that should not be processed):

.babelrc:
```json
{
  "plugins": [
    ["cycle-hmr", {
      "include": "**/cycles/**.js"      
    }]
  ]
}
```

If you don't use `include/exclude` options, no modules will be processed by default.
But you may mark files individually with comment on the top:
 ```js
 /* @cycle-hmr */
 ```

For each processed module `cycle-hmr` babel plugin will *wrap* all the exports 
with (safe) HMR proxy call and add `hot.accept()` (webpack/browserify HMR API),
so no dependants of the module will be reloaded when module change. 

*Note: if it proxies something that it should not, well, unlikely 
that it will break anything - HMR proxy wrapper is transparent for non-cyclic exports.*

It is easy to use cycle-hmr with **webpack** or **browserify**.

## Webpack
Just use `babel-loader` for your source files and pass the options `cycle-hrm` or use .babelrc.


```js
    new webpack.IgnorePlugin(/most-adapter/)
```

## Browserify

Use `babelify`. And use `--ingnore-missing` option to ignore missing dependencies. 


#### Debug output

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
