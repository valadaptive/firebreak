module.exports = {
    ecosystems: {
        output: {
            client: 'zod',
            mode: 'single',
            target: './src/gen/zod',
        },
        input: {
            target: './ecosyste-ms.yaml',
        },
    },
};
