
export type TessellationLayer = 'cl1' | 'dl1' | 'gl0' | 'gl1' | 'ml0';

export type NodeInfo = {
    clusterSession: number | string;
    host: string;
    id: string;
    layer: TessellationLayer;
    p2pPort: number;
    publicPort: number | string;
    session: number | string;
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

export type ClusterConsensusInfo = {
    key: number;
    peers: {
        clusterSession: string;
        id: string;
        ip: string;
        p2pPort: number;
        publicPort: number;
        session: string;
        state: 'Ready';
    }[];
}

export type NodeStatusInfo = {
    clusterSession: string;
    id: string;
    inConsensus: boolean;
    inNetwork: boolean;
    ip: string;
    session: string;
}

export type NodeDiagnosticInfo = {
    collateral: number;
    hasCollateral: boolean;
    hasHealthyState: boolean;
    hasLatestVersion: boolean;
    hasOpenP2PPort: boolean;
    hasOpenPublicPort: boolean;
    inSeedList: boolean;
    p2pPort: number;
    publicPort: number;
    state: string
    version: string;
}