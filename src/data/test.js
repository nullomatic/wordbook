const wordRegEx = `\\b\\p{L}+([-\\s']\\p{L}+)*\\b`;
//const originRegEx = `\\((<|cf\\. )?(?<origin>OE|NHG|Barnes)( (?<originWord>${wordRegEx}))?\\)`;
const re = new RegExp(
  `(?<!\\()(?<words>${wordRegEx}(, ${wordRegEx})*)(?!\\))(\\s?\\((?<origin>[^\\)]*)\\))?`,
  'iug'
);

console.log([
  ...'freelord (lady), athel,  foo ( ing / in-), thane'.matchAll(re),
]);
