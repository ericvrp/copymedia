const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const { promisify } = require('util')

const config = require('./config.json');
const set_xmp = require('./set_xmp');
const set_exif = require('./set_exif');

// some async functions
const execAsync = promisify(exec)
const existsAsync = promisify(fs.exists)
const mkdirAsync = promisify(fs.mkdir)
const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)


// settings...
const useHistory = false


//
const callbackFunction = (name, data) => {
    if (!callbackFunctions[name]) return console.log(`error: callbackFunction "${name}" not found`);
    callbackFunctions[name](data);
}

const log = message => callbackFunction(`log`, message);
const thumbnail = url => callbackFunction(`thumbnail`, url);
const finished = () => callbackFunction(`finished`);


//
const getAllFiles = dir =>
    fs.readdirSync(dir).reduce((files, file) => {
        const name = path.join(dir, file);
        const isDirectory = fs.statSync(name).isDirectory();
        return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
    }, []);

//
const readHistoryCache = () => {
    log(`Reading history cache files`);

    const historyFolder = path.join(__dirname, 'history')
    const historyPathnames = fs.readdirSync(historyFolder).filter(f => path.extname(f) === '.json');

    let h = {}

    historyPathnames.forEach(historyPathname => {
        const p = path.join(historyFolder, historyPathname);
        const historyFile = fs.readFileSync(p);

        if (historyFile.length > 0) {
            const newHistoryCache = JSON.parse(historyFile);
            h = Object.assign(h, newHistoryCache);
        }
    })

    log(`${Object.keys(h).length} prior imported media files`)
    return h
}

//
const writeHistoryCache = (historyCache, historyFilename) => {
    log(`Writing history cache file to ${historyFilename}`);

    const historyString = JSON.stringify(historyCache, null, 2);
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

        const cacheString = `${stat.size} ${stat.mtimeMs} ${sourcePathname}`;

        if (!historyCache[cacheString]) {
            const date               = projectName ? new Date() : new Date(stat.mtimeMs);
            const destinationBaseDirname = path.join(media.destination.path, `${date.getFullYear()}`, yyyymmdd(date) + (projectName ? " "+projectName : ""));
            const destinationDirname = path.join(destinationBaseDirname, media.destination.postfix);
    
            const creationDate        = new Date(stat.mtimeMs);
            const baseName            = yyyymmdd(creationDate)+" "+hhmmss(creationDate)+" "+path.basename(sourcePathname);
            const destinationPathname = path.join(destinationDirname, baseName);

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
let nCreateThumbnailTasks = 0;
let nCreatedThumbnails = 0;

//
const removeThumbnails = () => {
    const thumbnailsFolder = path.join(__dirname, 'thumbnails')
    fs.readdirSync(thumbnailsFolder).map(filename => {
        const thumbnailPathname = path.join(thumbnailsFolder, filename);
        if (thumbnailPathname.toLowerCase().endsWith('.jpg')) {
            // console.log(thumbnailPathname);
            fs.unlinkSync(thumbnailPathname); // because nconvert otherwise creates 1_1.jpg instead of 1.jpg
        } 
    });
}

const createThumbnail = async copyItem => {
    if (nCreateThumbnailTasks >= config.thumbnail.maxParallelTasks) {
        // console.log(`thumbnail creation skips ${thumbnailPathname}`);
        return;
    }

    const thumbnailPathname = path.join(__dirname, 'thumbnails', nCreatedThumbnails.toString()) + '.jpg';
    const createThumbnailCmd = path.join(__dirname, config.thumbnail.task)
        .replace('SRC', copyItem.destinationPathname)
        .replace('DEST', thumbnailPathname);
    // console.log(createThumbnailCmd);

    nCreateThumbnailTasks++;
    nCreatedThumbnails++;
    // console.log(`thumbnail task ${nCreateThumbnailTasks}/${config.thumbnail.maxParallelTasks} started for ${thumbnailPathname}`);
    
    execAsync(createThumbnailCmd)
        .then(() => {
            nCreateThumbnailTasks--;
            thumbnail(thumbnailPathname);
        })
        .catch(err => console.error(err))
} // end of createThumbnail(copyItem)

//
const copyAllMedia = async (_projectName, _callbackFunctions) => {
    projectName = _projectName // global
    callbackFunctions = _callbackFunctions // global
    nCreatedThumbnails = 0; // reset this global

    if (!_projectName && config.requireProjectName) {
        log(`error: no projectName`);
        finished();
        return;
    }

    log(`Copy all media for project ${_projectName}`);

    removeThumbnails();

    global.historyCache = useHistory ? readHistoryCache() : {};

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
    const newHistoryCache = {};
    const startTime = new Date();

    log(`Copy ${copyItems.length} files with a total of ${GBtotal.toFixed(2)} GB`);

    for (const copyItem of copyItems) {
        const t = new Date() - startTime;
        const done = copiedSize / totalSize;
        // log(done);
        const eta = done < 0.00001 ? 0 : t / done - t;
        const MBcopied = copiedSize / 1024 / 1024;
        log(`${mmss(t)} ${percentage(done * 100)} ETA in ${mmss(eta)} (${copyItem.baseName}) [${(MBcopied * 1000 / t).toFixed(2)} MB/s]`);

        if (!config.simulate) {
            const content = await readFileAsync(copyItem.sourcePathname);

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

            if (!(await existsAsync(copyItem.destinationDirname))) {
                // log(`Create folder ${copyItem.destinationDirname}`);
                await mkdirAsync(copyItem.destinationDirname, { recursive: true });
            }

            writeFileAsync(copyItem.destinationPathname, content)
                .then(() => createThumbnail(copyItem));
        } // else simulate

        copiedSize += copyItem.size;
        historyCache[copyItem.cacheString] = newHistoryCache[copyItem.cacheString] = true;
    } //); // next copyItem

    if (!config.simulate && copyItems.length > 0) {
        newHistoryCache['_destinationBaseDirname'] = copyItems[0].destinationBaseDirname;
        // log(newHistoryCache);
        const historyFilename = path.join(__dirname, `history`, `${new Date().getTime()}.json`);
        if (useHistory) writeHistoryCache(newHistoryCache, historyFilename);
    }

    log(`${mmss(new Date() - startTime)} ${percentage(100)} of ${GBtotal.toFixed(2)} GB copied`);

    log(`Copied all media for project ${projectName}`); // does this properly finish all pending writes on the commandline? (because of process.exit..)
    finished();
} // end of copyAllMedia(_projectName,_callbackFunctions)


//
// console.log(process.argv);
global.runAsCli = !process.argv[0].includes('electron.exe') && !process.argv[0].includes('copymedia.exe');
// console.log(`runAsCli ${runAsCli}`);

if (runAsCli) {
    copyAllMedia(process.argv[2], {
        'thumbnail': url => { log(`thumbnail ${url}`); },
        'log': message => { if (config.progressReport) console.log(message); },
        'finished': () => { console.log('finished'); process.exit(1); },
    });
}

//
module.exports = {
    copyAllMedia
}

// the end
