import fs from "node:fs";
import path from "node:path";

const ENV = {
    CL_L0_PEER_HTTP_HOST: '13.52.205.240',
    CL_L0_PEER_HTTP_PORT: '9000',
    PATH_DATA: '/Users/ffox/.node-pilot/hypergraph/gl0',
}

async function main() {
    await check();
}

async function check() {

    if (!ENV.PATH_DATA) {
        throw new Error('PATH_DATA is not set');
    }

    const dataDir = path.join(ENV.PATH_DATA, 'incremental_snapshot', 'ordinal');

    if (!fs.existsSync(dataDir)) {
        return false;
    }

    const chunks = fs.readdirSync(dataDir);

    for (const chunk of chunks) {
        const files = fs.readdirSync(path.join(dataDir, chunk));
        console.log(`Chunk: ${chunk}, files: ${files.length}`);

        for (const file of files) {
            // eslint-disable-next-line no-await-in-loop
            const hash = await getLocalSnapshotHash(file);
            // eslint-disable-next-line no-await-in-loop
            const sourceHash = await getSourceSnapshotHash(file);
            //
            if (Number.isNaN(hash) || Number.isNaN(sourceHash)) {
                console.log(`Error invalid hash - Ordinal: ${file}, Local Hash: ${JSON.stringify(hash)}, Source Hash: ${JSON.stringify(sourceHash)}`);
                break;
            }

            if (hash === sourceHash) {
                if (file.endsWith('000')) {
                    process.stdout.write(file);
                }
                else {
                    process.stdout.write('.');
                }
            }
            else {
                console.log(`\nOrdinal: ${file}, Local Hash: ${hash}, Source Hash: ${sourceHash}`);
            }
        }
    }
}

async function getLocalSnapshotHash(ordinal: string) {
    return fetch(`http://localhost:9000/global-snapshots/${ordinal}/hash`)
        .then(res =>  res.json())
        .catch(() => {
            throw new Error('Unable to connect');
        })
}

async function getSourceSnapshotHash(ordinal: string) {
    return fetch(`http://${ENV.CL_L0_PEER_HTTP_HOST}:${ENV.CL_L0_PEER_HTTP_PORT}/global-snapshots/${ordinal}/hash`)
        .then(res =>  res.json())
        .catch(() => {
            throw new Error('Unable to connect');
        })
}

main()
    // eslint-disable-next-line unicorn/prefer-top-level-await
    .catch(error => {
        console.error(error);
        process.exit(1);
    })
