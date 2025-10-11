import chalk from "chalk";


class CellFormatter {

    formatDistance (value: string) {
        if (value === '-') return value;
        const num = Number(value);
        if (num === 0) return value;
        if (num < 4) return this.style(value.toString(), "bgYellow", "bold");
        return this.style(value.toString(), "bgRed", "bold");
    }

    formatError (value: string) {

        if (value === '-') return value;
        return this.style(value, "bgRed", "bold")
    }

    formatOrdinal (value: string) {

        const [v,changed] = value.split(':');

        if (changed) {
            return this.style(v, "bgCyan");
        }

        return this.style(v, "cyan");
    }

    formatState (value: string) {

        if (value === 'Offline') return this.style(value, "bgRed", "bold")
        if (value === 'Ready') return this.style(value, "green")
        if (value === 'ReadyToJoin') return this.style(value, "yellow", "bold")
        if (value === 'Restarting') return this.style(value, "yellow", "bold")

        return this.style(value, "white")
    }

    formatUpTIme(startTime: number | string) {
        if (!startTime) return '-';
        const upTimeMs = Date.now() - Number(startTime);
        const upTimeSec = Math.floor(upTimeMs / 1000);
        const hours = Math.floor(upTimeSec / 3600);
        const minutes = Math.floor((upTimeSec % 3600) / 60);
        const seconds = upTimeSec % 60;
        if (hours < 1 && minutes < 1) return `${seconds}s`;
        return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
    }

    style(value: string, color: string, style?: string) {
        return `c${color}v${value}s${style}`
    }
}

const {formatDistance, formatError, formatOrdinal, formatState, formatUpTIme} = new CellFormatter();

// Layer | Uptime | State | Ordinal | Distance from cluster | Cluster State | Error
export const statusTableHeader = [
    { color: 'white', headerColor: 'whiteBright', value: 'Network' },
    { color: 'whiteBright', headerColor: 'whiteBright', value: 'Layer' },
    { color: 'white', formatter: formatUpTIme, headerColor: 'whiteBright', value: 'Uptime' },
    { color: 'white', formatter: formatState, headerColor: 'whiteBright', value: 'Node State', width: 18},
    { color: 'white', formatter: formatOrdinal, headerColor: 'whiteBright', value: 'Ordinal' },
    { color: 'white', formatter: formatDistance, headerColor: 'whiteBright', value: 'Ord. lag' },
    { color: 'white', formatter: formatState, headerColor: 'whiteBright', value: 'Cluster State', width: 16},
    { color: 'white', formatter: formatError, headerColor: 'whiteBright', value: 'Error', width: 22},
];


export type NodeStatusInfo = {
    clusterOrdinal: number;
    clusterSession: string;
    clusterState: string;
    error: string;
    ordinal: number;
    pilotSession: string;
    session: string;
    state: string;
}