const fs = require('fs');
const path = require('path');

const config = require('./config.json');
const set_xmp = require('./set_xmp');
const set_exif = require('./set_exif');

//
let _callbackFunctions = {}

const registerCallback = (name, cb) => {
    _callbackFunctions[name] = _callbackFunctions[name] || [];
    _callbackFunctions[name].push(cb);
}

const callbackFunction = (name, message) => {
    if (!_callbackFunctions[name]) return log(`error: callbackFunction "${name}" not registered`);
    _callbackFunctions[name].forEach(cb => cb(message));
}

const log = message => callbackFunction(`log`, message);
const finished = message => callbackFunction(`finished`, message);


//
const getAllFiles = dir =>
  fs.readdirSync(dir).reduce((files, file) => {
    const name = path.join(dir, file);
    const isDirectory = fs.statSync(name).isDirectory();
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
  }, []);

//
const readHistory = () => {
    log(`Reading history files`);

    const historyFolder = path.join(__dirname, 'history')
    const historyPathnames = fs.readdirSync(historyFolder).filter(f => path.extname(f) === '.json');

    let h = {}

    historyPathnames.forEach(historyPathname => {
        const p = path.join(historyFolder, historyPathname);
        const historyFile = fs.readFileSync(p);

        if (historyFile.length > 0) {
            const newHistory = JSON.parse(historyFile);
            h = Object.assign(h, newHistory);
        }
    })

    log(`${Object.keys(h).length} prior imported media files`)
    return h
}

//
const writeHistory = (history, historyFilename) => {
    log(`Writing history file to ${historyFilename}`);

    const historyString = JSON.stringify(history, null, 2);
    if (historyString.length <= 2) return; // skip empty history

    fs.writeFile(historyFilename, historyString, (err) => {
        if (err) throw err;
        // log(`Wrote history file of ${historyString.length} bytes to ${historyFilename}`);
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
        // log(cacheString);

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
    global.projectName = _projectName
    log(`Copy all media for project ${projectName}`);

    const history = readHistory();

    let copyItems = [];

    config.allMedia.forEach(media => {
        try {
            fs.readdirSync(media.source);
        } catch (e) {
            // log(`warning: ${media.source} is not available for copying ${media.extensions}`);
            return;
        }

        copyItems = copyItems.concat( getCopyItems(media) );
    })
    totalSize = copyItems.reduce((acc, copyItem) => acc + copyItem.size, 0);
    const GBtotal = totalSize / 1024 / 1024 / 1024;

    let copiedSize = 0;
    const newHistory = {};
    const startTime = new Date();

    log(`Copy ${GBtotal.toFixed(2)} GB`);

    copyItems.forEach(copyItem => {
        const t = new Date() - startTime;
        const done = copiedSize / totalSize;
        // log(done);
        const eta = done < 0.00001 ? 0 : t / done - t;
        const MBcopied = copiedSize / 1024 / 1024;
        log(`${mmss(t)} ${percentage(done * 100)} ETA in ${mmss(eta)} (${copyItem.baseName}) [${(MBcopied * 1000 / t).toFixed(2)} MB/s]`);

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
                // log(`Create folder ${copyItem.destinationDirname}`);
                fs.mkdirSync(copyItem.destinationDirname, { recursive: true });
            }

            fs.writeFile(copyItem.destinationPathname, content, (err) => {
                if (err) {
                    log(err.toString());
                    finished(`error: failed to write to ${copyItem.destinationPathname}`);
                    // process.exit(1);
                }
            });
        } // else simulate

        copiedSize += copyItem.size;
        history[copyItem.cacheString] = newHistory[copyItem.cacheString] = true;
    }); // next copyItem

    if (!config.simulate && copyItems.length > 0) {
        newHistory['_destinationBaseDirname'] = copyItems[0].destinationBaseDirname;
        // log(newHistory);
        const historyFilename = path.join(__dirname, `history`, `${new Date().getTime()}.json`);
        writeHistory(newHistory, historyFilename);
    }

    log(`${mmss(new Date() - startTime)} ${percentage(100)} of ${GBtotal.toFixed(2)} GB copied`);

    finished(`Copied all media for project ${projectName}`);

    if (config.looping.enabled) {
        setTimeout(copyAllMedia, config.looping.intervalInSeconds * 1000);
    }
} // end of copyAllMedia()

//
// log(process.argv);
const runAsCli = !process.argv[0].includes('electron.exe') && !process.argv[0].includes('copymedia.exe');
// log(`runAsCli ${runAsCli}`);

if (runAsCli) {
    registerCallback(`log`, message => { if (config.progressReport) console.log(message); } )
    registerCallback(`finished`, message => log(message) )

    const _projectName = process.argv[2]; // in global namespace
    if (!_projectName && config.requireProjectName) {
        log(`error: Missing required projectName parameter!`);
        process.exit(1);
    }
    // log(_projectName);

    if (config.simulate) {
        log('Simulation mode');
    }

    copyAllMedia(_projectName);
}

//
module.exports = {
    registerCallback,
    callbackFunction,
    copyAllMedia
}

// the end
