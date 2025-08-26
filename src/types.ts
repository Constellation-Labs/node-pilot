
export type TessellationLayer = 'cl1' | 'dl1' | 'gl0' | 'gl1' | 'ml0';

export type NodeInfo = {
    clusterSession: number;
    host: string;
    id: string;
    layer: TessellationLayer;
    p2pPort: number;
    publicPort: number;
    session: number;
    state: string;
    version: string;
}

export type ClusterInfo = {
    clusterSession: string;
    id: string;
    ip: string;
    jar: string;
    p2pPort: number;
    publicPort: number;
    session: string;
    state: 'DownloadInProgress' | 'GenesisReady' | 'Initial' | 'Leaving' | 'LoadingGenesis' | 'Offline' | 'Ready' | 'ReadyToJoin' | 'SessionStarted' | 'StartingSession' | 'Unavailable' | 'WaitingForDownload';
};
