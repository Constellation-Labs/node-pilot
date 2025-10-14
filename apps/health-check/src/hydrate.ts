import {archiveUtils} from "./utils/archive-utils.js";

async function main() {
    await archiveUtils.checkForCorruptAndMissingSnapshots();
}

process.on("exit", () => {
    console.log("Exiting...");
    archiveUtils.markAsCompleted();
});

process.on("SIGTERM", () => {
    console.log("SIGTERM received.");
    process.exit()
})

main()
    .then(() => {
        console.log("Hydrate completed successfully.");
        archiveUtils.markAsCompleted();
    })
    // eslint-disable-next-line unicorn/prefer-top-level-await
    .catch(error => {
        console.log("Hydrate failed.");
        console.error(error);
        archiveUtils.markAsCompleted();
        process.exit(1);
    })
