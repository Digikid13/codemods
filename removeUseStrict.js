export default function transformer(file, api) {
    const j = api.jscodeshift;

    const isInModule = (path) => (
        path &&
        path.parent &&
        path.parent.parent &&
        path.parent.parent.node.type === 'FunctionExpression' &&
        path.parent.parent.parent &&
        path.parent.parent.parent.node.type === 'CallExpression' &&
        path.parent.parent.parent.node.callee.name === 'define'
    );

    return j(file.source)
        .find(j.ExpressionStatement, { expression: { type: 'Literal' } })
        .forEach(path => {
            if (path.node.expression.value === 'use strict' && isInModule(path)) {
                path.replace(null);
            }
        })
        .toSource({
            quote: 'single',
            trailingComma: true,
        });
}

