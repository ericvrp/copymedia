// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  } 
  
  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})


// const { readFileSync } = require('fs')
// window.readConfig = function () {
//   const data = readFileSync('./config.json')
//   return JSON.parse(data)
// }

// console.log('IN PRELOAD.JS')
const { copyAllMedia } = require('./copyMedia.js')
// console.log(copyAllMedia)
window.copyAllMedia = function (_projectName) {
  // console.log('copyAllMedia for project:', _projectName)
  copyAllMedia(_projectName)
}
