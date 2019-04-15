export default function transformer(file, api) {
    const j = api.jscodeshift;
    let details;

    /* Helper Objects */

    const REACT_COMPONENT = {
        type: 'VariableDeclaration',
        declarations: [
            {
                init: {
                    type: 'CallExpression',
                    callee: {
                        object: {
                            name: 'React',
                            type: 'Identifier',
                        },
                        property: {
                            name: 'createClass',
                            type: 'Identifier',
                        },
                    },
                },
            },
        ]
    };

    const THIS_PROPS = {
        object: {
            type: 'ThisExpression',
        },
        property: {
            name: 'props',
        },
    };

    const THIS_CONTEXT = {
        object: {
            type: 'ThisExpression',
        },
        property: {
            name: 'context',
        },
    }

    const PROPERTY_FUCTION = {
        value: {
            type: 'FunctionExpression',
        }
    }

    /* Helper Methods */

    const getComponents = path =>
        path.find(j.VariableDeclaration, REACT_COMPONENT)

    const getComponentInfo = path => {
        let displayName, contextTypes, propTypes, renderBody;

        const variableName = path.value.declarations[0].id.name;

        path.value.declarations[0].init.arguments[0].properties.forEach(prop => {
            if (prop && prop.key) {
                if (prop.key.name === 'displayName')
                    displayName = prop.value.rawValue;

                if (prop.key.name === 'contextTypes')
                    contextTypes = prop.value.properties;

                if (prop.key.name === 'propTypes')
                    propTypes = prop.value.properties;

                if (prop.key.name === 'render')
                    renderBody = prop.value.body;
            }
        });

        displayName = displayName || variableName;

        return {
            displayName,
            contextTypes,
            propTypes,
            renderBody,
            variableName,
        };
    }

    const isRenderMethod = node => (
        node && node.key && node.value &&
        node.key.type == 'Identifier' &&
        node.key.name == 'render' &&
        node.value.type == 'FunctionExpression'
    );

    const onlyHasRenderMethod = path => (
        j(path)
            .find(j.Property, PROPERTY_FUCTION)
            .filter(p => !isRenderMethod(p.value))
            .size() === 0
    );

    const createPureComponent = (name, body) => {
        let args = [];

        if (details.propTypes)
            args.push('props')
        if (details.contextTypes)
            args.push('context')

        return j.variableDeclaration(
            'const',
            [j.variableDeclarator(
                j.identifier(name),
                j.arrowFunctionExpression(
                    [j.identifier(`(${args.join(', ')})`)],
                    replaceThisProps(body)
                )
            )]
        )
    };

    const replaceThisProps = path => {
        j(path)
            .find(j.MemberExpression, THIS_PROPS)
            .replaceWith(j.identifier('props'));

        j(path)
            .find(j.MemberExpression, THIS_CONTEXT)
            .replaceWith(j.identifier('context'));

        return path;
    }

    /* Component Replacement Start */

    const fileSource = j(file.source);

    const pureComponents = getComponents(fileSource)
        .filter(path => onlyHasRenderMethod(path));

    if (pureComponents.size() === 0)
        return null;

    pureComponents.replaceWith(path => {
        details = getComponentInfo(path);

        replaceThisProps(details.renderBody);

        return createPureComponent(details.displayName, details.renderBody);
    }).insertAfter(() => {
        if (!details.propTypes)
            return null;

        return j.expressionStatement(
            j.assignmentExpression(
                '=',
                j.memberExpression(
                    j.identifier(details.displayName),
                    j.identifier('propTypes')
                ),
                j.objectExpression(details.propTypes)
            )
        );
    }).insertAfter(() => {
        if (!details.contextTypes)
            return null;

        return j.expressionStatement(
            j.assignmentExpression(
                '=',
                j.memberExpression(
                    j.identifier(details.displayName),
                    j.identifier('contextTypes')
                ),
                j.objectExpression(details.contextTypes)
            )
        );
    }).insertAfter(() =>
        j.expressionStatement(
            j.assignmentExpression(
                '=',
                j.memberExpression(
                    j.identifier(details.displayName),
                    j.identifier('displayName')
                ),
                j.literal(details.displayName)
            )
        )
    );

    fileSource
        .find(j.ReturnStatement, {argument: {name: details.variableName}})
        .replaceWith(path =>
            j.returnStatement(j.identifier(details.displayName))
        );

    return fileSource.toSource({
        quote: 'single',
        trailingComma: true,
    });
}
