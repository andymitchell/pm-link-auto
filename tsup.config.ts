import { defineConfig } from "tsup";
 
export default defineConfig({
  entry: {

    'index': "src/index.ts",
    'cli': "src/cli.ts",
  },
  publicDir: false,
  clean: true,
  minify: false,
  target: ['esnext'],
  external: [
  ],
  format: ['esm'], 
  dts: true
});

