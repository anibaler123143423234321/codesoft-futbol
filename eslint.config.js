import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: [
      'dist', 'node_modules', 'scratch', 'scratch_save_spanish_data.mjs', 'data_raw', 'datos_crudos',
      // Integración de retransmisiones de RapidAPI: fuera del alcance de este lint
      'src/api/footballStreamApi.js',
    ],
  },

  // Código de la app (navegador)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Constantes que inyecta vite.config.js en tiempo de compilación
        __NVIDIA_MODEL__: 'readonly',
        __RAPIDAPI_KEY__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      // `import React` se mantiene por costumbre aunque el JSX moderno no lo necesite
      'no-unused-vars': ['warn', { varsIgnorePattern: '^(_|React$)', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Configuración y funciones de servidor (Node)
  {
    files: ['vite.config.js', 'eslint.config.js', 'netlify/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { ...js.configs.recommended.rules },
  },
];
