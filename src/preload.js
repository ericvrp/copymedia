const { registerCallback, copyAllMedia } = require('./copyMedia.js')

registerCallback(`log`, message => console.log(message))

window.copyAllMedia = copyAllMedia
