import nodeResolve from "@rollup/plugin-node-resolve";
import multiEntry from "@rollup/plugin-multi-entry";
import cjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";
import sourcemaps from "rollup-plugin-sourcemaps";
import shim from "rollup-plugin-shim";
import json from "@rollup/plugin-json";
import * as path from "path";
import inject from "@rollup/plugin-inject";

const pkg = require("./package.json");
const depNames = Object.keys(pkg.dependencies);
const input = "dist-esm/src/index.js";
const production = process.env.NODE_ENV === "production";

const version = pkg.version;
const banner = [
  "/*!",
  " * Copyright (c) Microsoft and contributors. All rights reserved.",
  " * Licensed under the MIT License. See License.txt in the project root for",
  " * license information.",
  " * ",
  ` * Azure App Configuration SDK for JavaScript - ${version}`,
  " */"
].join("\n");

export function nodeConfig(test = false) {
  const externalNodeBuiltins = ["events", "crypto", "path"];
  const baseConfig = {
    input: input,
    external: depNames.concat(externalNodeBuiltins),
    output: {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: true,
      banner: banner,
      name: "azureappconfiguration"
    },
    preserveSymlinks: false,
    plugins: [
      sourcemaps(),
      replace({
        delimiters: ["", ""]
      }),
      nodeResolve({ preferBuiltins: true }),
      cjs()
    ]
  };

  if (test) {
    // Entry points - test files under the `test` folder(common for both browser and node), node specific test files
    baseConfig.input = ["dist-esm/test/*.spec.js", "dist-esm/test/**/*.spec.js"];
    baseConfig.plugins.unshift(
      multiEntry({ exports: false }),
      json() // This allows us to import/require the package.json file, to get the version and test it against the user agent.
    );

    // different output file
    baseConfig.output.file = "test-dist/index.node.js";

    // mark assert packages we use as external
    baseConfig.external.push("assert");

    baseConfig.external.push(...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies));

    // Disable tree-shaking of test code.  In rollup-plugin-node-resolve@5.0.0, rollup started respecting
    // the "sideEffects" field in package.json.  Since our package.json sets "sideEffects=false", this also
    // applies to test code, which causes all tests to be removed by tree-shaking.
    baseConfig.treeshake = false;
  } else if (production) {
    baseConfig.plugins.push(terser());
  }

  return baseConfig;
}

export function browserConfig(test = false) {
  const baseConfig = {
    input: input,
    output: {
      file: "dist-browser/appconfiguration.js",
      format: "umd",
      name: "Azure.AppConfiguration",
      globals: {
        "@azure/core-http": "Azure.Core.HTTP",
        nock: "nock",
        fs: "fs-extra"
      },
      sourcemap: true
    },
    external: ["nock", "fs-extra"],
    preserveSymlinks: false,
    plugins: [
      sourcemaps(),
      replace({
        delimiters: ["", ""]
      }),

      shim({
        constants: `export default {}`,
        fs: `export default {}`,
        os: `export default {}`,
        dotenv: `export function config() { }`,
        path: `export function join() {}`,
        timers: `export default {}`,
        stream: `export default {}`,
        process: `export default {}`
      }),

      nodeResolve({
        mainFields: ["module", "browser"],
        preferBuiltins: false
      }),
      cjs({
        namedExports: {
          chai: ["assert", "expect", "use"],
          assert: ["ok", "equal", "strictEqual", "deepEqual", "fail", "throws", "notEqual"],
          events: ["EventEmitter"],
          "@opentelemetry/api": ["CanonicalCode", "SpanKind", "TraceFlags"]
        }
      }),

      inject({
        modules: {
          // Buffer: ["buffer", "Buffer"],
          process: "process"
        },
        exclude: ["./**/package.json"]
      }),

      json()
    ]
  };

  if (test) {
    baseConfig.input = ["dist-esm/test/*.spec.js", "dist-esm/test/internal/*.spec.js"];
    baseConfig.plugins.unshift(multiEntry({ exports: false }));
    baseConfig.output.file = "test-browser/index.js";

    // Disable tree-shaking of test code.  In rollup-plugin-node-resolve@5.0.0, rollup started respecting
    // the "sideEffects" field in package.json.  Since our package.json sets "sideEffects=false", this also
    // applies to test code, which causes all tests to be removed by tree-shaking.
    baseConfig.treeshake = false;
  }

  return baseConfig;
}
