// @ts-ignore
import PreloadWebpackPlugin from '@vue/preload-webpack-plugin';
// @ts-ignore
import WebpackBeforeBuildPlugin from 'before-build-webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import dotenv from 'dotenv';
import fs from 'fs';
import { GitRevisionPlugin } from 'git-revision-webpack-plugin';
import HtmlPlugin from 'html-webpack-plugin';
import yaml from 'js-yaml';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import type { Configuration } from 'webpack';
import {
  DefinePlugin, EnvironmentPlugin, NormalModuleReplacementPlugin, ProvidePlugin,
} from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

import 'webpack-dev-server';

const {
  APP_ENV, HEAD, ENV_EXTENSION, IS_ELECTRON,
} = process.env;

const gitRevisionPlugin = new GitRevisionPlugin();
const branch = HEAD || gitRevisionPlugin.branch();
const appRevision = !branch || branch === 'HEAD' ? gitRevisionPlugin.commithash()?.substring(0, 7) : branch;

const appVersion = require('./package.json').version;

const defaultI18nFilename = path.resolve(__dirname, './src/i18n/en.json');

dotenv.config();

export default function createConfig(
  _: any,
  { mode = 'production' }: { mode: 'none' | 'development' | 'production' },
): Configuration {
  return {
    mode,
    target: 'web',

    entry: {
      main: './src/index.tsx',
      extensionServiceWorker: './src/extension/serviceWorker.ts',
      extensionContentScript: './src/extension/contentScript.ts',
      extensionPageScript: './src/extension/pageScript/index.ts',
    },

    devServer: {
      port: 4321,
      host: '0.0.0.0',
      allowedHosts: 'all',
      hot: false,
      static: [
        {
          directory: path.resolve(__dirname, 'public'),
        },
        {
          directory: path.resolve(__dirname, 'src/lib/rlottie'),
        },
      ],
      devMiddleware: {
        stats: 'minimal',
      },
    },

    watchOptions: { ignored: defaultI18nFilename },

    output: {
      filename: (pathData) => (pathData.chunk?.name?.startsWith('extension') ? '[name].js' : '[name].[contenthash].js'),
      chunkFilename: '[id].[chunkhash].js',
      assetModuleFilename: '[name].[contenthash][ext]',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
    },

    module: {
      rules: [
        {
          test: /\.(ts|tsx|js)$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
              },
            },
            'postcss-loader',
          ],
        },
        {
          test: /\.module\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                modules: {
                  exportLocalsConvention: 'camelCase',
                  auto: true,
                  localIdentName: mode === 'production' ? '[hash:base64]' : '[name]__[local]',
                },
              },
            },
            'postcss-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.scss$/,
          exclude: /\.module\.scss$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader', 'sass-loader'],
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg|png|jpg|tgs|webp)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource',
        },
        {
          test: /\.wasm$/,
          type: 'asset/resource',
        },
        {
          test: /\.(txt|tl)$/i,
          type: 'asset/source',
        },
      ],
    },

    resolve: {
      extensions: ['.js', '.ts', '.tsx'],
      fallback: {
        crypto: false,
      },
    },

    plugins: [
      new WebpackBeforeBuildPlugin((stats: any, callback: VoidFunction) => {
        const defaultI18nYaml = fs.readFileSync('./src/i18n/en.yaml', 'utf8');
        const defaultI18nJson = convertI18nYamlToJson(defaultI18nYaml, mode === 'production');

        if (!defaultI18nJson) {
          return;
        }

        fs.writeFile(defaultI18nFilename, defaultI18nJson, 'utf-8', () => {
          callback();
        });
      }),
      new HtmlPlugin({
        template: 'src/index.html',
        chunks: ['main'],
      }),
      new PreloadWebpackPlugin({
        include: 'allAssets',
        fileWhitelist: [/duck_.*?\.png/], // Lottie thumbs
      }),
      new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
        chunkFilename: '[name].[chunkhash].css',
        ignoreOrder: true,
      }),
      /* eslint-disable no-null/no-null */
      new EnvironmentPlugin({
        APP_ENV: 'production',
        APP_MOCKED_CLIENT: '',
        APP_NAME: null,
        APP_VERSION: appVersion,
        APP_REVISION: appRevision,
        TEST_SESSION: null,
        TONHTTPAPI_MAINNET_URL: null,
        TONHTTPAPI_MAINNET_API_KEY: null,
        TONHTTPAPI_TESTNET_URL: null,
        TONHTTPAPI_TESTNET_API_KEY: null,
        TONAPIIO_MAINNET_URL: null,
        TONAPIIO_TESTNET_URL: null,
        BRILLIANT_API_BASE_URL: null,
        PROXY_HOSTS: null,
        STAKING_POOLS: null,
        IS_ELECTRON: false,
        ELECTRON_TONHTTPAPI_MAINNET_API_KEY: null,
        ELECTRON_TONHTTPAPI_TESTNET_API_KEY: null,
      }),
      /* eslint-enable no-null/no-null */
      new DefinePlugin({
        APP_REVISION: DefinePlugin.runtimeValue(
          () => {
            const { gitBranch, commit } = getGitMetadata();
            return JSON.stringify(!gitBranch || gitBranch === 'HEAD' ? commit : gitBranch);
          },
          mode === 'development' ? true : [],
        ),
      }),
      new ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'src/extension/manifest.json',
            transform: (content) => content.toString().replace('%%VERSION%%', appVersion),
          },
          {
            from: 'src/i18n/*.yaml',
            to: 'i18n/[name].json',
            transform: (content: Buffer) => convertI18nYamlToJson(
              content as unknown as string, mode === 'production',
            ) as any,
          },
        ],
      }),
      ...(mode === 'production' ? [new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false })] : []),
      ...(ENV_EXTENSION === '1'
        ? [
          new NormalModuleReplacementPlugin(
            /src\/api\/providers\/worker\/connector\.ts/,
            '../extension/connectorForPopup.ts',
          ),
        ]
        : []),
    ],

    devtool:
      ENV_EXTENSION === '1' ? 'cheap-source-map' : APP_ENV === 'production' && IS_ELECTRON ? undefined : 'source-map',

    ...(ENV_EXTENSION === '1' && {
      optimization: {
        minimize: false,
      },
    }),
  };
}

function getGitMetadata() {
  const revisionPlugin = new GitRevisionPlugin();
  const commit = revisionPlugin.commithash()?.substring(0, 7);

  return {
    gitBranch: HEAD || gitRevisionPlugin.branch(),
    commit,
  };
}

function convertI18nYamlToJson(content: string, shouldThrowException: boolean): string | undefined {
  try {
    const i18n = yaml.load(content) as AnyLiteral;

    const json: AnyLiteral = Object.entries(i18n).reduce((acc: AnyLiteral, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = { value };
      }
      if (typeof value === 'object') {
        acc[key] = { ...value };
      }

      return acc;
    }, {});

    return JSON.stringify(json, undefined, 2);
  } catch (err: any) {
    console.error(err.message); // eslint-disable-line no-console

    if (shouldThrowException) {
      throw err;
    }
  }

  return undefined;
}
