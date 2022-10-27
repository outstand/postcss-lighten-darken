const valueParser = require('postcss-value-parser');
var log = require('loglevel').getLogger('postcss-lighten-darken')

const rgbShorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
const rgbRegex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const hslaRegex = /^hsla\((?<h>\d+),\s?(?<s>\d+)%,\s?(?<l>\d+)%,\s?1\)$/i;

function argsFromNode(node) {
  return node.nodes.filter(function (node) {
    return node.type === 'word' || node.type === 'function';
  }).map(function (node) {
    return node.type === 'function' ? node : node.value;
  });
}

function validateArgs(args, functionName) {
  if (args.length != 2) {
    return [false, `Invalid call to ${functionName}(): Expected 2 arguments`];
  }

  if (typeof args[0] === 'object') {
    if (args[0].value !== 'hsla' && args[0].value !== 'lighten' && args[0].value !== 'darken') {
      return [false, `Invalid call to ${functionName}(): First argument must be a hex value, hsla color, or nested lighten/darken`];
    }
  } else {
    if (!args[0].startsWith('#')) {
      return [false, `Invalid call to ${functionName}(): First argument must be a hex value, hsla color, or nested lighten/darken`];
    }
  }

  if (!args[1].endsWith('%')) {
    `Invalid call to ${functionName}(): Second argument must be a percentage`
    return [false, `Invalid call to ${functionName}(): Second argument must be a percentage`];
  }

  return [true, null];
}

// Borrowed from madeleineostoja/postcss-hexrgba
function hexToRgb(hex) {
  hex = hex.replace(rgbShorthandRegex, (m, r, g, b) => {
    return r + r + g + g + b + b;
  });

  const rgb = hex.match(rgbRegex);

  // Convert it
  return rgb ? {
    r: parseInt(rgb[1], 16),
    g: parseInt(rgb[2], 16),
    b: parseInt(rgb[3], 16)
  } : false;
}

// Ported from sass/ruby-sass
function rgbToHsl(rgb) {
  let { r, g, b } = rgb;

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  var h;
  switch(max) {
    case min: h = 0; break;
    case r: h = 60 * (g - b) / d; break;
    case g: h = 60 * (b - r) / d + 120; break;
    case b: h = 60 * (r - g) / d + 240; break;
  }

  const l = (max + min) / 2;

  var s;
  if (max == min) {
    s = 0;
  } else if (l < 0.5) {
    s = d / (2 * l);
  } else {
    s = d / (2 - 2 * l);
  }

  return {
    h: Math.round(h % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return [false, `Unable to convert ${hex} to RGB`];
  }
  log.debug("rgb", rgb);

  const hsl = rgbToHsl(rgb);
  if (!hsl) {
    return [false, `Unable to convert ${rgb} to HSL`];
  }
  log.debug("hsl", hsl);

  return [true, hsl];
}

function parseHsla(color) {
  const matches = color.match(hslaRegex);

  if (Object.keys(matches.groups).length !== 3) {
    return [false, `Unable to parse ${color} to HSL`];
  }

  return [true, {
    h: parseInt(matches.groups.h),
    s: parseInt(matches.groups.s),
    l: parseInt(matches.groups.l)
  }]
}

function changeLightness(decl, valueNode, op, postcss) {
  const args = argsFromNode(valueNode);
  let [success, warning] = validateArgs(args, op);

  if (!success) {
    log.debug(warning);
    decl.warn(postcss.result, warning);
    return;
  }

  const color = args[0];
  const percentage = Number(args[1].replace('%', ''));

  log.debug("color", color);
  log.debug("percentage", percentage);

  let hsl;

  if (typeof color === 'object') {
    if (color.value === 'hsla') {
      [success, hsl] = parseHsla(valueParser.stringify(color));
    } else if (color.value === 'lighten' || color.value === 'darken'){
      // We found a nested call. Postcss will revisit this node after we process it.
      return;
    } else {
      const warning = `Unexpected function encountered (${color.value}). Unable to resolve color.`
      log.debug(warning);
      decl.warn(postcss.result, warning);
      return;
    }
  } else {
    [success, hsl] = hexToHsl(color);
  }

  if (!success) {
    const warning = hsl;
    log.debug(warning);
    decl.warn(postcss.result, warning);
    return;
  }

  switch(op) {
    case 'lighten': hsl.l = Math.min(hsl.l + percentage, 100); break;
    case 'darken': hsl.l = Math.max(hsl.l - percentage, 0); break;
  }

  return hsl;
}

function lighten(decl, valueNode, postcss) {
  log.debug('lighten', valueNode);
  return changeLightness(decl, valueNode, 'lighten', postcss);
}

function darken(decl, valueNode, postcss) {
  log.debug('darken', valueNode)
  return changeLightness(decl, valueNode, 'darken', postcss);
}

function handleRule(decl, postcss) {
  const value = valueParser(decl.value).walk(node => {
    if (node.type === 'function') {
      let result;
      log.debug(node);

      switch(node.value) {
        case 'lighten':
          result = lighten(decl, node, postcss);
          break;
        case 'darken':
          result = darken(decl, node, postcss);
          break;
        default:
          return;
      }

      if (!result) {
        log.info(`Exiting after bad result.`);
        return;
      }

      node.value = 'hsla';
      node.nodes = [
        {
          type: 'word',
          value: result.h
        },
        {
          type: 'div',
          value: ',',
          after: ' '
        },
        {
          type: 'word',
          value: `${result.s}%`
        },
        {
          type: 'div',
          value: ',',
          after: ' '
        },
        {
          type: 'word',
          value: `${result.l}%`
        },
        {
          type: 'div',
          value: ',',
          after: ' '
        },
        {
          type: 'word',
          value: '1'
        },
      ];
    }
  }).toString();

  log.debug('Setting decl value', value);
  decl.value = value;
}

/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  opts = {
    logLevel: 'warn',
    ...opts
  }

  log.setLevel(opts.logLevel)

  return {
    postcssPlugin: 'postcss-lighten-darken',

    Declaration (decl, postcss) {
      if (!decl.value.includes('lighten') && !decl.value.includes('darken')) {
        return;
      }

      handleRule(decl, postcss);
    }
  }
}

module.exports.postcss = true
