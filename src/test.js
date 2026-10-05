
const { getJevProvider } = require('./ai/jev-procider');
const jev = getJevProvider();
const test = await jev.noul(
    'The sky is blue. The grass is green',
    'Is the sky blue?'
)
console.log(test)