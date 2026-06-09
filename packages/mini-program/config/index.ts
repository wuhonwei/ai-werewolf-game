import { defineConfig } from '@tarojs/cli';

const apiBase = process.env.TARO_APP_API_BASE || 'http://localhost:3000';

export default defineConfig(async (merge) => {
  const base = {
    projectName: 'ai-werewolf',
    date: '2026-6-9',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: ['@tarojs/plugin-framework-react'],
    defineConstants: {
      TARO_APP_API_BASE: JSON.stringify(apiBase),
    },
    copy: { patterns: [], options: {} },
    framework: 'react',
    compiler: 'webpack5',
    mini: {
      postcss: {
        pxtransform: { enable: true, config: {} },
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
    },
  };

  if (process.env.NODE_ENV === 'development') {
    return merge({}, base, {});
  }
  return merge({}, base, {});
});
