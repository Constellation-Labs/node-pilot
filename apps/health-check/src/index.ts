import {main} from "./main.js";

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch(error => {
    console.error(error);
    process.exit(1);
});