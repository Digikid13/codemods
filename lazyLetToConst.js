export default function transformer(file, api) {
    const j = api.jscodeshift;

    const LET_DECLARATION = {
        kind: 'let',
    };

    const VAR_CHECK = (name) => ({
        left: {
            type: 'Identifier',
            name,
        },
    });

    return j(file.source)
        .find(j.VariableDeclaration, LET_DECLARATION)
        .forEach(path => {
            if (path.node.declarations.length > 1)
                return;

            const varName = path.node.declarations[0].id.name;
            const { comments } = path.node;

            if (j(file.source).find(j.AssignmentExpression, VAR_CHECK(varName)).length === 0) {
                j(path).replaceWith(j.variableDeclaration('const', path.node.declarations))
                j(path).get().node.comments = comments;
            }
        })
        .toSource();
}

