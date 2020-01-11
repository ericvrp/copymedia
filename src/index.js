const { ipcRenderer } = require('electron')


window.copyAllMedia = projectName => {
    document.getElementById(`copyMediaButton`).disabled = true // prefend multiple runs
    ipcRenderer.send(`copyAllMedia`, {projectName})
}

ipcRenderer.on('thumbnail', (event, url) => {
    // console.log(`thumbnail ${url}`)
    document.getElementById(`copymedia-thumbnail`).src = url
})

ipcRenderer.on('log', (event, message) => {
    // console.log(message)
    document.getElementById(`copymedia-status`).innerText = message
})

ipcRenderer.on(`copyAllMedia-finished`, (event) => {
    // console.log('copyAllMedia-finished')
    document.getElementById(`copyMediaButton`).disabled = false // allow another run
})
