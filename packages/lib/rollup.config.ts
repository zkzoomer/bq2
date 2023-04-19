import commonjs from "@rollup/plugin-commonjs"
import { nodeResolve }  from "@rollup/plugin-node-resolve"
import typescript from "rollup-plugin-typescript2"
import json from "@rollup/plugin-json"
import * as fs from "fs"

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"))
const banner = `/**
 * @module ${pkg.name}
 * @version ${pkg.version}
*/`

export default {
	input: 'src/index.ts',
    output: [
        { file: pkg.exports.require, format: "cjs", banner, exports: "auto" },
        { file: pkg.exports.import, format: "es", banner }
    ],
    external: Object.keys(pkg.dependencies),
    plugins: [
        typescript({
            tsconfig: "./build.tsconfig.json",
            useTsconfigDeclarationDir: true
        }),
        json(),
        commonjs(),
        nodeResolve({ preferBuiltins: true, mainFields: ['browser'] }),
    ]
};