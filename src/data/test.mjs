const re = new RegExp(`(?<words>(.|\\s)*)(?<origin>(?<=\\[).*(?=\\]))`, 'iug');

const str = `battle; camp (<ME), gouth (<OE), fight`;

console.log(str.replace(/\([^)]*\)/g, ',').split(/[^\w\s'-]/g));
