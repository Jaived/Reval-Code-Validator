const csstree = require('css-tree');

const css = `/* Demo CSS for validation */
body {
  background-color: #fff;
  background-color: white; /* ❌ Duplicate property */
  color: #333;
}

.container {
  width: 100%;
  height: ;
  border: 1px solid #000;
}

.text {
  font-size: 16px;
  font-weight: bold;
  font-weight: bold; /* ❌ Duplicate property */
}

.empty-rule {} /* ❌ Empty CSS rule */

.button {
  background-color: blue;
  background-color: #0000FF; /* ❌ Duplicate property (different format) */
}
`;

function analyze(cssText) {
  const issues = [];
  let ast;
  try {
    ast = csstree.parse(cssText, { positions: true });
  } catch (e) {
    console.error('Parse error', e.message);
    return [{ type: 'error', message: e.message }];
  }
  try {
    csstree.walk(ast, {
      visit: 'Rule',
      enter(node) {
        const lineNum = node.loc && node.loc.start ? node.loc.start.line : 1;
        const hasChildren = node.block && node.block.children && typeof node.block.children.getSize === 'function' ? node.block.children.getSize() : (node.block && node.block.children ? node.block.children.length : 0);
        if (!hasChildren) {
          issues.push({ type: 'warning', message: 'Empty rule', line: lineNum });
        }

        const decls = [];
        csstree.walk(node, {
          visit: 'Declaration',
          enter(decl) {
            const prop = decl.property;
            const value = csstree.generate(decl.value || decl);
            const ln = decl.loc && decl.loc.start ? decl.loc.start.line : lineNum;
            // empty declaration (like height: ;)
            const raw = (value || '').trim();
            if (!raw) {
              issues.push({ type: 'warning', message: `Empty declaration for '${prop}'`, line: ln });
            }
            // duplicate property detection
            const dup = decls.find(d => d.prop === prop);
            if (dup) {
              issues.push({ type: 'warning', message: `Duplicate property '${prop}'`, line: ln });
            }
            decls.push({ prop, value, line: ln });
          }
        });
      }
    });
  } catch (e) {
    console.error('walk error', e && e.stack ? e.stack : e);
    return [{ type: 'error', message: String(e) }];
  }

  return issues;
}

const out = analyze(css);
console.log(JSON.stringify(out, null, 2));
