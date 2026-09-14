const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/**
 * Metro has to be told about the shared core, exactly as Turbopack did.
 *
 * `packages/core` lives outside this app so the Next.js app can compile the
 * same source. Metro only watches the project root by default and only resolves
 * modules from this app's `node_modules`, so without the two settings below the
 * bundle fails with "Unable to resolve module @core/..." — the mobile twin of
 * the Turbopack failure recorded in docs/MOBILE_PLAN.md.
 *
 * `watchFolders` lets Metro see the files. `extraNodeModules` maps the alias.
 * `disableHierarchicalLookup` is deliberately NOT set: the core needs to find
 * `zod`, and letting resolution walk up is how it does.
 */
const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');
const coreRoot = path.resolve(repoRoot, 'packages/core/src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [coreRoot, path.resolve(repoRoot, 'packages/core/node_modules')];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@core': coreRoot,
};

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'packages/core/node_modules'),
];

/**
 * `zod` resolves from two places — this app's node_modules and the core
 * package's — because `nodeModulesPaths` lists both. Two copies of a 6 MB
 * library land in the bundle and both initialise at startup. Pinning the alias
 * to one physical copy removes the duplicate.
 */
config.resolver.alias = {
  ...config.resolver.alias,
  zod: path.resolve(projectRoot, 'node_modules/zod'),
};

/**
 * Defer module initialisation until first use.
 *
 * Without this every module in the graph — all of Clerk, all of zod, every
 * screen — runs its top-level code before the first frame paints. `inlineRequires`
 * rewrites imports so a module only initialises when something actually reads
 * from it, which is the standard React Native startup fix and matters most on
 * the mid-range Android hardware this app is aimed at.
 */
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
