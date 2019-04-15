export default function transformer(file, api) {
    // Replace all new lines in define with special strings to be re-replaced later
    let i = 0;
    const DEFINE_REGEX = /^(define[\w\s\n\(\[',-/\]{}\/\$?!:]*\) {)/g;
    const alpha = 'abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    if (file.source.match(DEFINE_REGEX)) {
        const DEFINE_BLOCK = (file.source.match(DEFINE_REGEX)[0]).replace(/\n\n/g, (match) => `\nTHIS_IS_A_NEWLINE_${alpha[i++]},\n`);
        file.source = file.source.replace(DEFINE_REGEX, DEFINE_BLOCK)
    } else {
        return file.source;
    }

    const j = api.jscodeshift;
    const fileSrc = j(file.source);
    const constantDependants = {};
    const constantRegex = /(?:([A-Z]+))/g;

    const IDENTIFIER = {
        type: 'Identifier',
    };

    const MEMBER_EXPRESSION = {
        object: {
            type: 'Identifier',
        },
        property: {
            type: 'Identifier',
        },
    };

    fileSrc
        .find(j.Identifier, IDENTIFIER)
        .filter(path => (
            path.parent.node.type === 'FunctionExpression' &&
            path.parent.parent.node.type === 'CallExpression' &&
            path.parent.parent.node.callee.name === 'define'
        ))
        .forEach(path => {
            if (constantRegex.test(path.node.name))
                constantDependants[path.node.name] = [];
        });

    fileSrc
        .find(j.MemberExpression, MEMBER_EXPRESSION)
        .forEach(path => {
            const constantName = path.node.object.name;
            const constantDependant = path.node.property.name;

            if (constantDependants[constantName]) {
                if (!constantDependants[constantName].includes(constantDependant))
                    constantDependants[constantName].push(constantDependant)

                j(path).replaceWith(j.identifier(constantDependant))
            }
        });

    fileSrc
        .find(j.Identifier)
        .filter(path => (
            path.parent.node.type === 'FunctionExpression' &&
            path.parent.parent.node.type === 'CallExpression' &&
            path.parent.parent.node.callee.name === 'define'
        ))
        .forEach(path => {
            if (constantDependants[path.node.name]) {
                const properties = [];

                constantDependants[path.node.name].forEach(dep => {
                    const prop = j.property(
                        'init',
                        j.identifier(dep),
                        j.identifier(dep)
                    );

                    prop.shorthand = true;

                    properties.push(prop);
                });

                j(path).replaceWith(
                    j.objectPattern(properties)
                )
            }
        });

    // Replace all random THIS_IS_A_NEWLINE_ with double newlines
    let newFileSrc = fileSrc.toSource();
    //newFileSrc = newFileSrc.replace(/THIS_IS_A_NEWLINE_\w,/g, '');

    // Turn all destructuring statements into single line statements
    const DEFINE_BLOCK_B = ((newFileSrc.match(DEFINE_REGEX)[0]).replace(/\n\s{8}/g, ' ')).replace(/\n\s{4}},?/g, ' },');
    newFileSrc = newFileSrc.replace(DEFINE_REGEX, DEFINE_BLOCK_B);

    return newFileSrc;
}
