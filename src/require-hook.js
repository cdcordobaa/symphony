// Patches Node's CJS loader so that relative `.js` imports resolve correctly
// when ts-node runs in CommonJS mode (nodenext sources import with `.js` extension).
'use strict';
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    typeof request === 'string' &&
    request.endsWith('.js') &&
    (request.startsWith('./') || request.startsWith('../'))
  ) {
    const stripped = request.slice(0, -3);
    try {
      return originalLoad.call(this, stripped, parent, isMain);
    } catch {
      // Fall through to original request if stripped version doesn't resolve
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};
