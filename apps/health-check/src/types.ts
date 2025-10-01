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
    hasJoined: boolean;
    inConsensus: boolean;
    inNetwork: boolean;
    ordinal: number;
    session: string;
    state: string;
}

export type TimerInfo = {
    fatal: boolean;
    isHydrateRunning: boolean;
    lastSession: string;
    lastState: string;
    observingStartTime: number;
    waitForDownloadStartTime: number;
}

export type ArchiveInfo = {
    endTime: number;
    isRunning: boolean;
    pid: number;
    startTime: number;
}