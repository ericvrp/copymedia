const { registerCallback, copyAllMedia } = require('./copyMedia.js')

const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
} 

registerCallback(`log`, message => {
    console.log(message)
    replaceText(`copymedia-status`, message)

    document.getElementById(`copyMediaButton`).disabled = true
})

registerCallback(`finished`, message => {
    console.log(message)
    replaceText(`copymedia-status`, message)

    document.getElementById(`copyMediaButton`).disabled = false // allow another run
})

window.copyAllMedia = copyAllMedia
