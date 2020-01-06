const config = require('./config.json');

const fs = require('fs');
const path = require('path');

const set_xmp = require('./set_xmp');
const set_exif = require('./set_exif');

//
const getAllFiles = dir =>
  fs.readdirSync(dir).reduce((files, file) => {
    const name = path.join(dir, file);
    const isDirectory = fs.statSync(name).isDirectory();
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
  }, []);

//
const readHistory = () => {
    if (config.progressReport) {
        console.log(`reading history files`);
    }

    const historyFolder = path.join(__dirname, 'history')
    // console.log('BEFORE readdirSync', historyFolder)
    const historyPathnames = fs.readdirSync(historyFolder).filter(f => path.extname(f) === '.json');
    // console.log('AFTER readdirSync', historyFolder)

    let h = {}

    historyPathnames.forEach(historyPathname => {
        const p = path.join(historyFolder, historyPathname);
        const historyFile = fs.readFileSync(p);

        if (historyFile.length > 0) {
            const newHistory = JSON.parse(historyFile);
            h = Object.assign(h, newHistory);
        }
    })

    if (config.progressReport) {
        console.log(`${Object.keys(h).length} prior imported media files`)
    }

    return h
}

//
const writeHistory = (history, historyFilename) => {
    if (config.progressReport) {
        console.log(`writing history file to ${historyFilename}`);
    }

    const historyString = JSON.stringify(history, null, 2);
    // console.log('historyString.length', historyString.length)
    if (historyString.length <= 2) return; // skip empty history

    fs.writeFile(historyFilename, historyString, (err) => {
        if (err) throw err;
        // console.log(`wrote history file of ${historyString.length} bytes to ${historyFilename}`);
    });
}

//
const yyyymmdd = date => {
    const yyyy     = `${date.getFullYear()}`;
    const month    = date.getMonth()+1;
    const day      = date.getDate();
    const mm       = (month < 10 ? "0" : "") + month;
    const dd       = (day   < 10 ? "0" : "") + day;
    return `${yyyy}-${mm}-${dd}`;
}

const hhmmss = date => {
    const hours        = date.getHours();
    const minutes      = date.getMinutes() ;
    const seconds      = date.getSeconds();
    const hh           = (hours   < 10 ? "0" : "") + hours;
    const mi           = (minutes < 10 ? "0" : "") + minutes;
    const ss           = (seconds < 10 ? "0" : "") + seconds;
    return `${hh}.${mi}.${ss}`;
}

const mmss = t => {
    const date         = new Date(t);
    const minutes      = date.getMinutes() ;
    const seconds      = date.getSeconds();
    const mi           = (minutes < 10 ? "0" : "") + minutes;
    const ss           = (seconds < 10 ? "0" : "") + seconds;
    return `${mi}:${ss}`;
}

const percentage = (value, digitsBefore = 3, digitsAfter = 2) => {
    let s = value.toFixed(digitsAfter); 
    while (s.length <= digitsBefore + digitsAfter) s = ' ' + s;
    return s + '%';
}

//
const getCopyItems = media => {
    let copyItems = [];

    const sourcePathnames = getAllFiles(media.source).filter(f => media.extensions.includes(path.extname(f)));

    sourcePathnames.forEach(sourcePathname => {
        const stat = fs.statSync(sourcePathname);

        const date               = projectName ? new Date() : new Date(stat.mtimeMs);
        const destinationBaseDirname = path.join(media.destination.path, `${date.getFullYear()}`, yyyymmdd(date) + (projectName ? " "+projectName : ""));
        const destinationDirname = path.join(destinationBaseDirname, media.destination.postfix);

        const creationDate        = new Date(stat.mtimeMs);
        const baseName            = yyyymmdd(creationDate)+" "+hhmmss(creationDate)+" "+path.basename(sourcePathname);
        const destinationPathname = path.join(destinationDirname, baseName);
        
        const cacheString = `${stat.size} ${stat.mtimeMs} ${sourcePathname}`;
        // console.log(cacheString);

        if (!history[cacheString]) {
            copyItems.push({
                cacheString,
                sourcePathname,
                destinationBaseDirname,
                destinationDirname,
                destinationPathname,
                baseName,
                size: stat.size,
                media,
            });
        }
    }); // next sourcePathname

    return copyItems;
} // end of getCopyItems(media)

//
const copyAllMedia = (_projectName) => {
    const history = readHistory();

    global.projectName = _projectName
    // console.log('_projectName', _projectName)
    // console.log('projectName', projectName)

    let copyItems = [];

    if (config.progressReport) {
        console.log(`creating list of files to be copied for project ${_projectName}`);
    }

    config.allMedia.forEach(media => {
        try {
            fs.readdirSync(media.source);
        } catch (e) {
            // console.warn(`warning: ${media.source} is not available for copying ${media.extensions}`);
            return;
        }

        copyItems = copyItems.concat( getCopyItems(media) );
    })
    totalSize = copyItems.reduce((acc, copyItem) => acc + copyItem.size, 0);
    const GBtotal = totalSize / 1024 / 1024 / 1024;

    let copiedSize = 0;
    const newHistory = {};
    const startTime = new Date();

    if (config.progressReport) {
        console.log(`copy ${GBtotal.toFixed(2)} GB`);
    }

    copyItems.forEach(copyItem => {
        if (config.progressReport) {
            const t = new Date() - startTime;
            const done = copiedSize / totalSize;
            // console.log(done);
            const eta = done < 0.00001 ? 0 : t / done - t;
            const MBcopied = copiedSize / 1024 / 1024;
            console.log(`${mmss(t)} ${percentage(done * 100)} ETA in ${mmss(eta)} (${copyItem.baseName}) [${(MBcopied * 1000 / t).toFixed(2)} MB/s]`);
        }

        if (!config.simulate) {
            const content = fs.readFileSync(copyItem.sourcePathname);

            if (copyItem.media.set_xmp) {
                copyItem.media.set_xmp.forEach(xmp => {
                    set_xmp[xmp](copyItem);
                })
            }

            if (copyItem.media.set_exif) {
                copyItem.media.set_exif.forEach(exif => {
                    set_exif[exif](copyItem);
                })
            }

            if (!fs.existsSync(copyItem.destinationDirname)) {
                // console.log("create folder", copyItem.destinationDirname);
                fs.mkdirSync(copyItem.destinationDirname, { recursive: true });
            }

            fs.writeFile(copyItem.destinationPathname, content, (err) => {
                if (err) {
                    console.error(err);
                    process.exit(1);
                    // throw err;
                }
            });
        } // else simulate

        copiedSize += copyItem.size;
        history[copyItem.cacheString] = newHistory[copyItem.cacheString] = true;
    }); // next copyItem

    if (!config.simulate && copyItems.length > 0) {
        newHistory['_destinationBaseDirname'] = copyItems[0].destinationBaseDirname;
        // console.log(newHistory);
        const historyFilename = path.join(__dirname, `history`, `${new Date().getTime()}.json`);
        writeHistory(newHistory, historyFilename);
    }

    if (config.progressReport) {
        console.log(`${mmss(new Date() - startTime)} ${percentage(100)} of ${GBtotal.toFixed(2)} GB copied`);
    }

    if (config.looping.enabled) {
        setTimeout(copyAllMedia, config.looping.intervalInSeconds * 1000);
    }
} // end of copyAllMedia()

//
// console.log(process.argv)
const runAsCli = !process.argv[0].includes('electron.exe') && !process.argv[0].includes('copymedia.exe')
// console.log('runAsCli', runAsCli)

if (runAsCli) {
    const _projectName = process.argv[2]; // in global namespace
    if (!_projectName && config.requireProjectName) {
        console.error("error: missing required projectName parameter");
        process.exit(1);
    }
    // console.log(_projectName);

    if (config.simulate) {
        console.log('simulation mode');
    }

    copyAllMedia(_projectName);
}


module.exports = {
    copyAllMedia
}


// the end
