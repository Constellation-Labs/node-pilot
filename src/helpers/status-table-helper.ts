import os from "node:os";

class CellFormatter {

    formatCpu (value: string) {
        if (!value || value === '-') return '-';
        const cores = os.cpus().length;
        const num = Number.parseFloat(value) / cores;
        value = num.toFixed(1) + '%';
        if (num === 0) return value;
        if (num < 40) return this.style(value, "green");
        if (num < 85) return this.style(value, "yellow", "bold");
        return this.style(value, "bgRed", "bold");
    }

    formatDistance (value: string) {
        if (!value || value === '-') return '-';
        const num = Number(value);
        if (num <= 0) return value;
        if (num < 9) return this.style(value,"bgYellow", "whiteBright", "bold");
        return this.style(value, "bgRed", "bold");
    }

    formatError (value: string) {
        if (!value || value === '-') return '-';
        return this.style(value, "bgRed", "bold")
    }

    formatMem (value: string) {
        if (!value || value === '-') return '-';
        const num = Number.parseInt(value, 10);
        if (num === 0) return value;
        if (num < 86) return this.style(value.toString(), "green");
        if (num < 99) return this.style(value.toString(), "yellow", "bold");
        return this.style(value.toString(), "red", "bold");
    }

    formatOrdinal (value: string) {
        if (!value || value === '-') return '-';
        const [v,changed] = value.split(':');

        if (changed) {
            return this.style(v, "bgCyan", "whiteBright", "bold");
        }

        return this.style(v, "cyan");
    }

    formatState (value: string) {
        if (!value || value === '-') return '-';
        if (value === 'Offline') return this.style(value, "bgRed", "bold")
        if (value === 'Ready') return this.style(value, "green")
        if (value === 'HydratingSnapshots') return this.style(value, "cyan")
        if (value === 'ReadyToJoin' || value === 'JoiningCluster') return this.style(value, "yellow", "bold")
        if (value.startsWith('Start')) return this.style(value, "yellow")
        if (value.startsWith('Ready')) return this.style(value, "green")

        return this.style(value, "white")
    }

    formatUpTIme(startTime: number | string) {
        if (Number.isNaN(Number(startTime))) return '-';
        const formattedTime = formatTime(Date.now() - Number(startTime), true);
        return formattedTime ?? '-';
    }

    style(value: string, color: string, style1?: string, style2?: string) {
        return `c${color}v${value}s${style1}-${style2}`;
    }
}

const {
    formatCpu, formatDistance, formatError, formatMem, formatOrdinal, formatState, formatUpTIme} = new CellFormatter();

export function formatTime(time: number, includeSeconds: boolean) {
    if (!time) return '';
    const upTimeMs = Number(time);
    const upTimeSec = Math.floor(upTimeMs / 1000);
    const hours = Math.floor(upTimeSec / 3600);
    const minutes = Math.floor((upTimeSec % 3600) / 60);
    const seconds = upTimeSec % 60;
    if (hours < 1 && minutes < 1) return `${seconds}s`;
    if (includeSeconds) {
        return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
    }

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatTimeAgo(value: number) {
    const timeAgo = formatTime(value, false);
    if (!timeAgo) return null;
    return timeAgo + ' ago';
}

// Layer | Uptime | State | Ordinal | Distance from cluster | Cluster State | CPU Usage | Mem Usage | Error
export const statusTableHeader = [
    { color: 'white', headerColor: 'whiteBright', value: 'Network' },
    { color: 'whiteBright', headerColor: 'whiteBright', value: 'Layer' },
    { color: 'white', formatter: formatUpTIme, headerColor: 'whiteBright', value: 'Uptime' },
    { color: 'white', formatter: formatState, headerColor: 'whiteBright', value: 'Node State', width: 24},
    { color: 'white', formatter: formatOrdinal, headerColor: 'whiteBright', value: 'Ordinal' },
    { color: 'white', formatter: formatDistance, headerColor: 'whiteBright', value: 'Distance' },
    { color: 'white', formatter: formatState, headerColor: 'whiteBright', value: 'Cluster State', width: 16},
    { color: 'white', formatter: formatCpu, headerColor: 'whiteBright', value: 'CPU Usage', width: 12 },
    { color: 'white', formatter: formatMem, headerColor: 'whiteBright', value: 'Mem Usage', width: 12 },
    { color: 'white', formatter: formatError, headerColor: 'whiteBright', value: 'Error', width: 22},
];

export const glHeader1 = [
    // { color: 'white', headerColor: 'whiteBright', value: 'Network' },
    // { color: 'whiteBright', headerColor: 'whiteBright', value: 'Layer' },
    { color: 'white', formatter: formatState, headerColor: 'whiteBright', value: 'Node State', width: 22},
    { color: 'white', formatter: formatUpTIme, headerColor: 'whiteBright', value: 'Uptime', width: 13 },
    { color: 'white', formatter: formatOrdinal, headerColor: 'whiteBright', value: 'Ordinal', width: 16 },
    { color: 'white', formatter: formatDistance, headerColor: 'whiteBright', value: 'Distance', width: 22},
];

export const glHeader2 = [
    { color: 'white', formatter: formatState, headerColor: 'whiteBright', value: 'Cluster State', width: 22},
    { color: 'white', formatter: formatCpu, headerColor: 'whiteBright', value: 'CPU Usage', width: 13 },
    { color: 'white', formatter: formatMem, headerColor: 'whiteBright', value: 'Mem Usage', width: 16 },
    { color: 'white', formatter: formatError, headerColor: 'whiteBright', value: 'Error', width: 22},
];


export type NodeStatusInfo = {
    clusterOrdinal: number;
    clusterSession: string;
    clusterState: string;
    cpuUsage: string;
    error: string;
    errorDate: number;
    lastError: string;
    memUsage: string;
    ordinal: number;
    pilotSession: string;
    session: string;
    state: string;
}