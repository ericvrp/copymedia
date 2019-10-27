const config = require('./config.json');

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
    const historyPathnames = fs.readdirSync('history').filter(f => path.extname(f) === '.json');
    
    let h = {}

    historyPathnames.forEach(historyPathname => {
        const p = path.join('history', historyPathname);
        const historyFile = fs.readFileSync(p);

        if (historyFile.length > 0) {
            const newHistory = JSON.parse(historyFile);
            h = Object.assign(h, newHistory);
        }
    })

    // console.log(h);
    return h
}

//
const writeHistory = (history, historyFilename) => {
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

//
const copyMedia = media => {
    const newHistory = {}
    const sourcePathnames = getAllFiles(media.source).filter(f => media.extensions.includes(path.extname(f)));

    sourcePathnames.forEach(sourcePathname => {
        const stat = fs.statSync(sourcePathname);

        const date               = projectName ? new Date() : new Date(stat.mtimeMs);
        const destinationDirname = path.join(media.destination.path, `${date.getFullYear()}`, yyyymmdd(date) + (projectName ? " "+projectName : ""), media.destination.postfix);

        const creationDate        = new Date(stat.mtimeMs);
        const baseName            = yyyymmdd(creationDate)+" "+hhmmss(creationDate)+" "+path.basename(sourcePathname);
        const destinationPathname = path.join(destinationDirname, baseName);
        
        const cacheString = `${stat.size} ${stat.mtimeMs} ${sourcePathname}`; // ${destinationPathname}`;
        // console.log(cacheString);

        if (history[cacheString]) {
            // console.log("skip", sourcePathname, "=>", destinationPathname);
            return;
        }

        console.log(`${config.simulate ? "simulate " : ""}copy ${sourcePathname} => ${destinationPathname}`);

        if (!config.simulate) {
            const content = fs.readFileSync(sourcePathname);

            if (!fs.existsSync(destinationDirname)) {
                // console.log("create folder", destinationDirname);
                fs.mkdirSync(destinationDirname, { recursive: true });
            }

            fs.writeFile(destinationPathname, content, (err) => {
                if (err) {
                    console.error(err);
                    process.exit(1);
                    // throw err;
                }
            });
        }

        history[cacheString] = newHistory[cacheString] = true;
    });

    if (!config.simulate) {
        writeHistory(newHistory, `history/${new Date().getTime()}.json`);
    }
}

//
const copyAllMedia = () => {
    config.allMedia.forEach(media => {
        try {
            fs.readdirSync(media.source);
        } catch (e) {
            console.warn(`warning: ${media.source} is not available for copying ${media.extensions}`);
            return;
        }

        copyMedia(media);
    })

    if (config.looping.enabled) {
        setTimeout(copyAllMedia, config.looping.intervalInSeconds * 1000);
    }
}

//
const projectName = process.argv[2];
if (!projectName && config.requireProjectName) {
    console.error("error: missing required projectName parameter");
    process.exit(1);
}
// console.log(projectName);

const history = readHistory();
copyAllMedia();

// the end
