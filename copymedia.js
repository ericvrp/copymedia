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
const copyMedia = media => {
    const sourceFiles = getAllFiles(media.source).filter(f => media.extensions.includes(path.extname(f)));
    // console.log(sourceFiles);

    console.log(`TODO: read ${sourceFiles.length} files from ${media.source}`);
    console.log(`TODO: write ${sourceFiles.length} files to ${media.destination}`);

    writeHistory({}, `history/${new Date()}.json`);
}

//
const copyAllMedia = () => {
    config.allMedia.forEach(media => {
        try {
            fs.readdirSync(media.source);
        } catch (e) {
            console.warn(`warning: ${media.source} is not available`);
            return;
        }

        copyMedia(media);
    })

    if (config.loop) {
        setTimeout(copyAllMedia, config.loopIntervalSeconds * 1000);
    }
}

//
const history = readHistory();

copyAllMedia();

// the end
