export enum TessellationLayer {
    CL1 = 'cl1',
    DL1 = 'dl1',
    GL0 = 'gl0',
    GL1 = 'gl1',
    ML0 = 'ml0',
}

export const CHUNK_SIZE = 20_000;

export type BackupInfo = {
    date: string;
    dir: string
}

export enum NodeState {
    DownloadInProgress = 'DownloadInProgress',
    Initial = 'Initial',
    Leaving = 'Leaving',
    Observing = 'Observing',
    Offline = 'Offline',
    Ready = 'Ready',
    ReadyToJoin = 'ReadyToJoin',
    SessionStarted = 'SessionStarted',
    SessionStarting = 'SessionStarting',
    StartingSession = 'StartingSession',
    Unavailable = 'Unavailable',
    WaitingForDownload = 'WaitingForDownload',
    WaitingForReady = 'WaitingForReady',
}

export type UserInfo = {
    discordUser: string;
    webHookEnabled: boolean;
}

export type NodeInfo = {
    clusterSession: string;
    host: string;
    id: string;
    p2pPort: number;
    publicPort: number | string;
    session: string;
    state: NodeState;
    version: string;
}

// export type TessellationLayerType = keyof typeof TessellationLayer;

export type NodeStatusInfo = {
    clusterOrdinal: number;
    clusterSession: string;
    clusterState: string;
    cpuLastTime: string;
    cpuLastUsage: string;
    cpuUsage: string;
    error: string;
    errorDate: number;
    hashMismatchCount: number;
    hasJoined: boolean;
    inConsensus: boolean;
    inNetwork: boolean;
    lastError: string;
    memUsage: string;
    ordinal: number;
    pilotSession: string;
    rebootRequired: boolean;
    session: string;
    state: string;
    unavailableCount: number;
}

export type TimerInfo = {
    clusterQueue: number;
    fatal: boolean;
    isHydrateRunning: boolean;
    lastState: string;
    observingStartTime: number;
    upgrade: boolean
    waitForDownloadStartTime: number;
}

export type ArchiveInfo = {
    endTime: number;
    isRunning: boolean;
    pid: string;
    startTime: number;
}