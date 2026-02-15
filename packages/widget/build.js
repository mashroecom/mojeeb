const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, 'src', 'widget.ts')],
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  target: ['es2020'],
  format: 'iife',
  outfile: path.join(__dirname, 'dist', 'mojeeb-widget.js'),
  charset: 'utf8',
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      const result = await esbuild.build(buildOptions);
      const outPath = buildOptions.outfile;
      const stats = fs.statSync(outPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      console.log(`Built ${outPath} (${sizeKB} KB)`);
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
