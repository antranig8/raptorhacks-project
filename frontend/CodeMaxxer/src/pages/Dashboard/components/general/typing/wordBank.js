const JS_KEYWORDS = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'default', 'async', 'await', 'new', 'typeof', 'null', 'undefined', 'true', 'false']
const JS_NOUNS = ['user', 'data', 'result', 'count', 'index', 'item', 'list', 'value', 'name', 'config', 'token', 'key', 'error', 'response', 'payload', 'node', 'state', 'cache', 'queue', 'event', 'flag', 'size', 'limit', 'id', 'map', 'set', 'task', 'handler']
const JS_VERBS = ['get', 'set', 'fetch', 'update', 'parse', 'filter', 'reduce', 'find', 'sort', 'push', 'load', 'save', 'delete', 'create', 'init', 'reset', 'handle', 'process', 'validate', 'merge', 'clone', 'bind', 'emit', 'resolve']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function camel(a, b) {
  return a + b[0].toUpperCase() + b.slice(1)
}

function randVar() {
  return Math.random() > 0.5 ? pick(JS_NOUNS) : camel(pick(JS_VERBS), pick(JS_NOUNS))
}

function randVal() {
  const r = Math.random()
  if (r < 0.25) return String(Math.floor(Math.random() * 1000))
  if (r < 0.5)  return `'${pick(JS_NOUNS)}'`
  if (r < 0.75) return Math.random() > 0.5 ? 'true' : 'false'
  return 'null'
}

export function randomText(lineCount = 10) {
  const generators = [
    // const/let declaration
    () => {
      const decl = Math.random() > 0.5 ? 'const' : 'let'
      return `${decl} ${randVar()} = ${randVal()};`
    },
    // function call
    () => `${randVar()}.${pick(JS_VERBS)}(${randVal()});`,
    // arrow function
    () => {
      const param = pick(JS_NOUNS)
      return `const ${camel(pick(JS_VERBS), pick(JS_NOUNS))} = (${param}) => ${param}.${pick(JS_VERBS)}();`
    },
    // if statement
    () => `if (${randVar()} === ${randVal()}) { ${randVar()} = ${randVal()}; }`,
    // for...of loop
    () => `for (const ${pick(JS_NOUNS)} of ${randVar()}s) { ${randVar()}.${pick(JS_VERBS)}(); }`,
    // return statement
    () => `return ${randVar()};`,
    // console.log
    () => `console.log(${randVar()});`,
    // await call
    () => `const ${randVar()} = await ${camel(pick(JS_VERBS), pick(JS_NOUNS))}(${randVal()});`,
    // comment
    () => `// ${pick(JS_VERBS)} the ${pick(JS_NOUNS)} before ${pick(JS_VERBS)}ing`,
  ]

  const lines = []
  for (let i = 0; i < lineCount; i++) {
    lines.push(pick(generators)())
  }
  return lines.join('\n')
}

export default {
  randomText,
}