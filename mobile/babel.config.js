/**
 * Reanimated 4 compiles its animation callbacks into "worklets" that run on the
 * UI thread, and that compilation is a Babel plugin. `babel-preset-expo` in SDK
 * 54 does not add it, so without this file every `useAnimatedStyle` silently
 * returns nothing and animations simply do not play — no error, no warning.
 *
 * The worklets plugin must be LAST in the list. It rewrites function bodies,
 * and any plugin running after it would be transforming code it no longer
 * recognises.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
