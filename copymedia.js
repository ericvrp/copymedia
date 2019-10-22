const config = require('./config.json');

// const { execSync } = require('child_process');

//
const fs = require('fs');
const path = require('path');

const getAllFiles = dir =>
  fs.readdirSync(dir).reduce((files, file) => {
    const name = path.join(dir, file);
    const isDirectory = fs.statSync(name).isDirectory();
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
  }, []);

//
const readHistory = () => {
    const historyJSON = fs.readdirSync('history').filter(f => path.extname(f) === '.json');
    console.log(`TODO: read and parse ${historyJSON.length} history files`);
    // console.log(historyJSON)
    
    return {

    }
}

//
const writeHistory = (history, historyFilename) => {
    console.log(`TODO: write new history file to ${historyFilename}`);
}

//
const history = readHistory();

config.forEach(conf => {
    const sourceFiles = getAllFiles(conf.source).filter(f => conf.extensions.includes(path.extname(f)));
    // console.log(sourceFiles);

    console.log(`TODO: read ${sourceFiles.length} files from ${conf.source}`);
    console.log(`TODO: write ${sourceFiles.length} files to ${conf.destination}`);

    writeHistory({}, `history/${new Date()}.json`);
})

