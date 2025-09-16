import {NodeInfo} from "../types.js";

export const getRandomNode = (nodes: Pick<NodeInfo, 'host' | 'id' | 'publicPort'>[]): Promise<NodeInfo> => {
    const randomNodeIndex  = Math.floor(Math.random() * nodes.length);
    const node = nodes[randomNodeIndex];

    console.log(`Getting random node from ${nodes.length} nodes: ${node.host}:${node.publicPort}`);

    return fetch(`http://${node.host}:${node.publicPort}/node/info`)
        .then(async res => {
            if (res.ok) return res.json();
            throw new Error(`Failed`);
        })
        .catch(() => {
            if ( nodes.length === 1) throw new Error(
                `Failed to get random node. All nodes are offline.`
            )
            return getRandomNode(nodes.toSpliced(randomNodeIndex,1));
        })

}

