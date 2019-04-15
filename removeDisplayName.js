export default function transformer(file, api) {
    const j = api.jscodeshift;

    const DISPLAY_NAME_EXP = {
        type: 'ExpressionStatement',
        expression: {
            type: 'AssignmentExpression',
            left: {
                type: 'MemberExpression',
                property: {
                    type: 'Identifier',
                    name: 'displayName',
                },
            },
        },
    };

    const DISPLAY_NAME_PROP = {
        type: 'Property',
        key: {
            type: 'Identifier',
            name: 'displayName',
        },
    };

    const parentIsComponent = node => (
        node && node.parent && node.parent.value &&
        node.value.type === 'ObjectExpression' &&
        node.parent.value.type === 'CallExpression' &&
        node.parent.value.callee.object.type === 'Identifier' &&
        node.parent.value.callee.object.name === 'React' &&
        node.parent.value.callee.property.type === 'Identifier' &&
        node.parent.value.callee.property.name === 'createClass'
    );

    const fileSource = j(file.source);

    fileSource
        .find(j.ExpressionStatement, DISPLAY_NAME_EXP)
        .filter(path => path.parent.value.type === 'BlockStatement')
        .remove();

    fileSource
        .find(j.Property, DISPLAY_NAME_PROP)
        .filter(path => parentIsComponent(path.parent))
        .remove();

    return fileSource.toSource({
        quote: 'single',
        trailingComma: true,
    });
}
