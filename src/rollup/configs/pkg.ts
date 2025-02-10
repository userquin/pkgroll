import type { RollupOptions } from 'rollup';
import type { TransformOptions } from 'esbuild';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import type { TsConfigResult } from 'get-tsconfig';
import type { AliasMap } from '../../types.js';
import { esbuildTransform, esbuildMinify } from '../plugins/esbuild.js';
import { externalizeNodeBuiltins } from '../plugins/externalize-node-builtins.js';
import { patchBinary } from '../plugins/patch-binary.js';
import { resolveTypescriptMjsCts } from '../plugins/resolve-typescript-mjs-cjs.js';
import { resolveTsconfigPaths } from '../plugins/resolve-tsconfig-paths.js';
import { stripHashbang } from '../plugins/strip-hashbang.js';
import { esmInjectCreateRequire } from '../plugins/esm-inject-create-require.js';
import type { Options, EnvObject, Output } from '../types.js';

export const getPkgConfig = (
	options: Options,
	aliases: AliasMap,
	env: EnvObject,
	executablePaths: string[],
	tsconfig: TsConfigResult | null,
) => {
	const esbuildConfig: TransformOptions = {
		target: options.target,
		tsconfigRaw: tsconfig?.config,
	};

	return {
		input: [] as string[],
		preserveEntrySignatures: 'strict' as const,
		plugins: [
			externalizeNodeBuiltins(options),
			...(
				tsconfig
					? [resolveTsconfigPaths(tsconfig)]
					: []
			),
			resolveTypescriptMjsCts(),
			alias({
				entries: aliases,
			}),
			nodeResolve({
				extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
				exportConditions: options.exportCondition,
			}),
			...(
				Object.keys(env).length > 0
					? [replace({
						preventAssignment: true,

						/**
                         * Seems this currently doesn't work:
                         * https://github.com/rollup/plugins/pull/1084#discussion_r861447543
                         */
						objectGuards: true,
						values: env,
					})]
					: []
			),
			stripHashbang(),
			json(),
			esbuildTransform(esbuildConfig),
			commonjs({
				ignoreDynamicRequires: true,
				extensions: ['.js', '.ts', '.jsx', '.tsx'],
				transformMixedEsModules: true,
			}),
			dynamicImportVars({
				warnOnError: true,
			}),
			...(
				options.minify
					? [esbuildMinify(esbuildConfig)]
					: []
			),
			patchBinary(executablePaths),
			esmInjectCreateRequire(),
		],
		output: [] as unknown as Output,
		external: [] as (string | RegExp)[],
	} satisfies RollupOptions;
};
