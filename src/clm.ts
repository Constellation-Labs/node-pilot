import chalk from "chalk";

/*
    Command Line Messaging with color styling
 */
export const clm = {
    debug (msg: string) {
        if(process.env.DEBUG === 'true') {
            console.log('[debug]', msg);
        }
    },

    echo(msg: string) {
        console.log(msg);
    },

    error (msg: string, silent = true) {
        console.error(chalk.red(msg));
        process.exit(silent ? 0 : 1);
    },

    postStep(s: string) {
        console.log(chalk.green(s));
    },

    preStep(s: string) {
        console.log('\n', chalk.italic(chalk.green(s)));
    },

    step(msg: string) {
        console.warn(chalk.whiteBright(msg));
    },

    warn(msg: string) {
        console.warn(chalk.red(msg));
    }
}