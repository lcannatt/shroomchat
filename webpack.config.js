var webpack = require('webpack');
module.exports ={
	entry: './build/chat-ui.js',
	output: {
		filename:'./public/scripts/bundle.js',
		path: __dirname
	},
	module: {
		rules: [
			{
				test: /\.js?/,
				loader:'babel-loader',
				exclude: /node_modules/,
				query: {
					presets: ['env']
				}
			}
		]
	},
	// watch:true
}