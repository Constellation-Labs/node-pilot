import {archiveUtils} from "./utils/archive-utils";

async function main() {
    await archiveUtils.checkForCorruptAndMissingSnapshots();
}

main()
    .then(() => {
        archiveUtils.markAsCompleted();
    })
    // eslint-disable-next-line unicorn/prefer-top-level-await
    .catch(error => {
        console.error(error);
        archiveUtils.markAsCompleted();
        process.exit(1);
    })
