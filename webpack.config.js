const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    output: {
        filename: '[name].[hash:4].js',
        publicPath: process.env.PUBLIC_PATH || '/',
    },
    entry: ['./app.js', './style.less'],
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].[hash:4].css',
        }),
        new HtmlWebpackPlugin({
            template: 'index.html',
            filename: 'index.html',
            minify: {
                collapseWhitespace: true,
            },
            hash: false,
            inject: true,
        }),
    ],
    devServer: {
        contentBase: __dirname,
        disableHostCheck: true,
        host: 'localhost',
        port: 8080,
        proxy: {
            '/bffportal': {
                changeOrigin: true,
                logs: true,
                target: process.env.REST_HOST || 'http://127.0.0.1:16003',
            },
        },
        historyApiFallback: {
            rewrites: [
                {
                    from: /./,
                    to: '/index.html',
                },
            ],
        },
    },
    module: {
        rules: [
            {
                test: /\.less$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            plugins: () => [
                                require('autoprefixer')(), // 浏览器兼容前缀
                                require('cssnano')(), // css 压缩
                            ],
                        },
                    },
                    'less-loader',
                ]
            }
        ]
    }
};
