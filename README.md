# postcss-lighten-darken

[PostCSS] plugin to add sass-style lighten/darken.

[PostCSS]: https://github.com/postcss/postcss

Basic usage:
```css
.foo {
  td { background: lighten(#5E6469, 57%); }
  background: darken(#f0f0f0, 15%);
}
```

```css
.foo {
  td { background: hsla(207, 6%, 96%, 1); }
  background: hsla(0, 0%, 79%, 1);
}
```

Nested usage (w/ postcss-simple-vars):
```css
$primary-color: #5E6469;
$table-stripe-color: lighten($primary-color, 57%);

.foo {
  td { background: darken($table-stripe-color, 3%); }
}
```

```css
.foo {
  td { background: hsla(207, 6%, 93%, 1); }
}
```

## Usage

**Step 1:** Install plugin:

```sh
npm install --save-dev postcss postcss-lighten-darken
```

**Step 2:** Add the plugin to plugins list:

```diff
module.exports = {
  plugins: [
+   require('postcss-lighten-darken'),
    require('autoprefixer')
  ]
}
```

[official docs]: https://github.com/postcss/postcss#usage
