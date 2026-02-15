const en = require('../apps/web/src/messages/en.json');
const ar = require('../apps/web/src/messages/ar.json');

function getKeys(obj, prefix) {
  prefix = prefix || '';
  var keys = [];
  var ks = Object.keys(obj);
  for (var i = 0; i < ks.length; i++) {
    var k = ks[i];
    var path = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

var enKeys = getKeys(en);
var arKeys = getKeys(ar);
var enSet = {};
enKeys.forEach(function(k) { enSet[k] = 1; });
var arSet = {};
arKeys.forEach(function(k) { arSet[k] = 1; });

var missingAr = enKeys.filter(function(k) { return !arSet[k]; });
var missingEn = arKeys.filter(function(k) { return !enSet[k]; });

console.log('Missing in ar.json (' + missingAr.length + '):');
missingAr.forEach(function(k) { console.log('  - ' + k); });
console.log('Missing in en.json (' + missingEn.length + '):');
missingEn.forEach(function(k) { console.log('  - ' + k); });
console.log('Total EN:', enKeys.length, '| Total AR:', arKeys.length);
