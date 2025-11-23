import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Fix Monaco worker resolution for all languages
      'monaco-editor$': 'monaco-editor/esm/vs/editor/editor.api.js',
      'monaco-editor/esm/vs/editor/editor.worker': 'monaco-editor/esm/vs/editor/editor.worker.js',
      'monaco-editor/esm/vs/language/json/json.worker': 'monaco-editor/esm/vs/language/json/json.worker.js',
      'monaco-editor/esm/vs/language/css/css.worker': 'monaco-editor/esm/vs/language/css/css.worker.js',
      'monaco-editor/esm/vs/language/html/html.worker': 'monaco-editor/esm/vs/language/html/html.worker.js',
      'monaco-editor/esm/vs/language/typescript/ts.worker': 'monaco-editor/esm/vs/language/typescript/ts.worker.js',
      // Add workers for C++, Java, Python, etc.
      'monaco-editor/esm/vs/language/cpp/cpp.worker': 'monaco-editor/esm/vs/language/cpp/cpp.worker.js',
      'monaco-editor/esm/vs/language/java/java.worker': 'monaco-editor/esm/vs/language/java/java.worker.js',
      'monaco-editor/esm/vs/language/python/python.worker': 'monaco-editor/esm/vs/language/python/python.worker.js',
    },
  },
});