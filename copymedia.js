const config = require('./config.json');

const { execSync } = require('child_process');

config.forEach(conf => {
    const ls = `ls -lR ${conf.source} | grep -i -E "(${conf.extensions.join('|')})"`

    const sourceFiles = execSync(ls).toString().trim().split('\n')
    const historyFilename = `history/${new Date()}.json`;

    console.log(`TODO: read ${sourceFiles.length} files from ${conf.source}`);
    console.log(`TODO: write ${sourceFiles.length} files to ${conf.destination}`);
    console.log(`TODO: write ${historyFilename}`);
})

