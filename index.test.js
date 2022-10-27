const postcss = require('postcss')
const dedent = require('dedent')
const postcssSimpleVars = require('postcss-simple-vars')

const plugin = require('./')

async function run (input, output, opts = { }) {
  let { plugins, ...pluginOpts } = opts

  if (plugins === undefined) {
    plugins = [plugin(pluginOpts)];
  }

  let result = await postcss(plugins).process(input, { from: undefined })
  expect(result.css).toEqual(output)
  expect(result.warnings()).toHaveLength(0)
}

it('parses a correct lighten call', async () => {
  await run(
    dedent`
    td { background: lighten(#5E6469, 57%); }
    `,
    dedent`
    td { background: hsla(207, 6%, 96%, 1); }
    `
  )
})

it('parses a correct lighten call with an hsla color', async () => {
  await run(
    dedent`
    td { background: lighten(hsla(197, 100%, 50%, 1), 10%); }
    `,
    dedent`
    td { background: hsla(197, 100%, 60%, 1); }
    `
  )
})

it('parses a correct darken call', async () => {
  await run(
    dedent`
    background: darken(#f0f0f0, 15%);
    `,
    dedent`
    background: hsla(0, 0%, 79%, 1);
    `
  )
})

it('parses a nested darken call', async () => {
  await run(
    dedent`
    $primary-color: #5E6469;
    $table-stripe-color: lighten($primary-color, 57%);

    td { background: darken($table-stripe-color, 3%); }
    `,
    dedent`
    td { background: hsla(207, 6%, 93%, 1); }
    `,
    {
      logLevel: 'debug',
      plugins: [postcssSimpleVars, plugin]
    }
  )
})
