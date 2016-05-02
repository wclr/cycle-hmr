import includeExclude from 'include-exclude'
import * as t from 'babel-types'
import path from 'path'

const defaultWrapperName = 'hmrProxy'

const getWrapperName = (importWrapper = defaultWrapperName) => {
  return '__' + importWrapper
}

const getRelativeName = (filename) =>
  path.relative(process.cwd(), filename)
    .split(path.sep).join('_').replace(/\..+$/, '')

export const addImport =
  (node, importWrapper = defaultWrapperName, importFrom = 'cycle-hmr') => {
    const importLiteral = importWrapper
    const importLocalLiteral = getWrapperName(importWrapper)
    let importIdentifier = t.identifier(importLiteral)
    let importLocalIdentifier = t.identifier(importLocalLiteral)

    const importDeclaration = t.importDeclaration([
      t.importSpecifier(importLocalIdentifier, importIdentifier)
    ], t.stringLiteral(importFrom));
    node.body.unshift(importDeclaration);
  }

const addHotAccept = (node) => {
  const acceptCall = t.callExpression(
    t.memberExpression(t.identifier('module.hot'), t.identifier('accept')),
    []
  )
  const statement = t.ifStatement(
    t.identifier('module.hot'),
    t.expressionStatement(acceptCall)
  )
  node.body.unshift(statement);
}

const checkComments = function(test, comments, options){
  return comments.reduce((prev, {value}) =>
    prev || test.test(value), false
  )
}

const checkIncludeComments = (comments, options) =>
  checkComments(/@cycle-hmr/, comments, options)

const checkDebugComments = (comments, options) =>
  checkComments(/@cycle-hmr-debug/, comments, options)


const checkExcludeComments = (comments, options) =>
  checkComments(/@no-cycle-hmr/, comments, options)


export default function ({types: t}) {

  const makeVisitor = (scope, moduleIdName, options) => {
    const wrapIdentifier = t.identifier(getWrapperName(options.importWrapper))
    const wrap = (node, name) => {
      scope.__hasCycleHmr = true
      return t.callExpression(wrapIdentifier, [
        node, t.binaryExpression('+',
          t.identifier('module.id'), t.stringLiteral('_' + moduleIdName + '_' + name)
        )
      ].concat(options.proxy ? t.identifier(JSON.stringify(options.proxy)) : []))
    }
    const wrapAndReplace = (path, name) => {
      scope.__hasCycleHmr = true
      var wrapped = wrap(path.node, name)
      return path.replaceWith(wrapped)
    }

    const exportFunctionDeclaration = (path, isDefault) => {
      if (path.__hmrWrapped) return
      const declaration = path.node.declaration
      const name = declaration.id.name
      const proxiedIdentifier = t.identifier(name)
      const proxiedDeclaration = t.variableDeclaration('const', [
        t.variableDeclarator(
          proxiedIdentifier,
          // wrap(t.functionExpression(null, declaration.params,
          //   declaration.body,
          //   declaration.generator, declaration.async), name)
          t.functionExpression(null, declaration.params,
            declaration.body,
            declaration.generator, declaration.async)
        )
      ])

      path.insertBefore(proxiedDeclaration)
      if (isDefault){
        path.replaceWith(t.exportDefaultDeclaration(
          proxiedIdentifier
        ))
      } else {
        path.replaceWith(t.exportNamedDeclaration(
          null, [
            t.exportSpecifier(
              proxiedIdentifier,
              proxiedIdentifier
            )
          ]
        ))
      }
    }

    return {
      ExportDefaultDeclaration (path) {
        if (path.__hmrWrapped) return

        if (path.node.declaration.type === 'FunctionDeclaration'){
          exportFunctionDeclaration(path, true)
          return
        }

        path.replaceWith(t.ExportDefaultDeclaration(
          wrap(path.node.declaration, 'default')
        ))
        path.__hmrWrapped = true
      },
      ExportSpecifier (path){
        if (path.__hmrWrapped) return
        const proxiedIdentifier = t.identifier(path.node.exported.name + '__hmr')
        const proxiedDeclaration = t.variableDeclaration('const', [
          t.variableDeclarator(
            proxiedIdentifier,
            wrap(path.node.local, path.node.exported.name)
          )
        ])
        let parentPath = path.parentPath
        parentPath.insertBefore(proxiedDeclaration)

        path.replaceWith(t.exportSpecifier(proxiedIdentifier, path.node.exported))
        path.__hmrWrapped = true
      },
      ExportNamedDeclaration (path) {
        if (path.__hmrWrapped) return
        const declarations = []
        const doWrap = (path) => declarations.filter(d => d === path.parentPath.node)[0]
        let exportVisitors = {
          'FunctionExpression|ArrowFunctionExpression' (path) {
            var dec = doWrap(path)
            if (dec){
              wrapAndReplace(path, dec.id.name)
            }
          }
        }
        let declaration = path.node.declaration
        if (declaration){
          if (declaration.declarations){
            declaration.declarations
              .forEach((declaration) => {
                declarations.push(declaration)
              })
            path.traverse(exportVisitors)
          } else {
            if (declaration.type == 'FunctionDeclaration'){
              exportFunctionDeclaration(path)
            }
          }
        }
      }
    }
  }

  return  {
    visitor: {
      Program (path, state) {
        const scope = path.context.scope
        const options = {...this.opts}
        const filename = this.file.opts.filename

        const filter = includeExclude(options);
        const hasFilter = options.include || options.exclude
        const comments = path.container.comments
        if (!filter(filename)){
          if (hasFilter){
            if (!checkIncludeComments(comments, options)){
              return
            }
          }
          return
        }

        if (!hasFilter){
          if (checkExcludeComments(comments, options)){
            return
          }
        }

        if (!options.debug && checkDebugComments(comments)){
          options.debug = true
        }

        const moduleIdName = getRelativeName(filename)
        path.traverse(makeVisitor(scope, moduleIdName, options))

        if (scope.__hasCycleHmr && options.import !== false){
          addImport(path.node, options.importWrapper, options.importFrom)
        }

        if (scope.__hasCycleHmr && options.accept !== false){
          addHotAccept(path.node)
        }
      }
    }
  }
}
