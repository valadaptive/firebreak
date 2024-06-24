import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylistic,
    {
        plugins: {
            '@stylistic': stylistic,
        },
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        files: ['**/*.ts', '**/*.js', 'eslint.config.js', 'orval.config.js'],
        rules: {
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/eol-last': ['error', 'always'],
            '@stylistic/indent': ['error', 4],
            '@stylistic/key-spacing': 'error',
            '@stylistic/max-len': ['warn', 120, {
                ignoreUrls: true,
                ignoreTemplateLiterals: true,
            }],
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/object-curly-spacing': 'error',
            '@stylistic/semi': 'error',
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/member-delimiter-style': 'error',

            '@typescript-eslint/consistent-type-definitions': 'off',
            '@typescript-eslint/restrict-template-expressions': ['error', {
                allowNumber: true,
            }],
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
        ignores: ['src/gen/**/*'],
    },
    {
        files: ['**/*.js'],
        extends: [tseslint.configs.disableTypeChecked],
    },
);
