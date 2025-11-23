import {clm} from "../clm.js";
import {configStore} from "../config-store.js";
import {shellService} from "../services/shell-service.js";

// Utility to parse human-readable sizes (e.g., 10M, 2.5G) to bytes
function parseSize(sizeStr: string): number {
    const multipliers = { '': 1, 'G': 1024 ** 3, 'K': 1024, 'M': 1024 ** 2, 'P': 1024 ** 5, 'T': 1024 ** 4 };
    const match = sizeStr.match(/([\d.]+)([KMGTP]?)/i);
    if (!match) return 0;
    const num = Number.parseFloat(match[1]);
    const unit = match[2].toUpperCase() as keyof typeof multipliers;
    return num * (multipliers[unit] || 1);
}

// Utility to format bytes to human-readable string
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['K', 'M', 'G', 'T', 'P'];
    let i = -1;
    do {
        bytes /= 1024;
        i++;
    } while (bytes >= 1024 && i < units.length - 1);

    return `${bytes.toFixed(2)}${units[i]}`;
}

export const checkDiskSpace = {

    async checkDiskUsage() {
        const logSize = await this.getReclaimableDiskSpace('logs');
        const dataSize = await this.getReclaimableDiskSpace('data');

        console.log(`\n${logSize} ${dataSize}`);

        await this.getDockerReclaimableDiskUsage();
    },


    async getDockerReclaimableDiskUsage() {
        // Get docker system disk usage summary
        const output = await shellService.runCommandWithOutput('docker system df --format "{{json .}}"');
        // docker system df --format outputs one JSON object per line
        let totalBytes = 0;
        const details = [];
        for (const line of output.split('\n')) {
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                // Try to sum up reclaimable space from images, containers, volumes, and build cache
                if (obj.Reclaimable && obj.Reclaimable !== "") {
                    // Reclaimable is like "1.23GB (45%)" or "123MB (10%)"
                    const match = obj.Reclaimable.match(/([\d.]+)\s*([KMGTP]?B)/i);
                    if (match) {
                        const num = Number.parseFloat(match[1]);
                        const unit = match[2].replace('B', ''); // Remove trailing B
                        const multipliers = { '': 1, 'G': 1024**3, 'K': 1024, 'M': 1024**2, 'P': 1024**5, 'T': 1024**4 };
                        totalBytes += num * (multipliers[unit.toUpperCase() as keyof typeof multipliers] || 1);
                        details.push(`${obj.Type}: ${match[0]}`);
                    }
                }
            } catch {
                // Ignore parse errors
            }
        }

        clm.preStep(`Docker reclaimable disk usage: ${formatBytes(totalBytes)}${details.length > 0 ? ' (' + details.join(', ') + ')' : ''}`);

        return formatBytes(totalBytes);
    },

    async getReclaimableDiskSpace(area: 'data' | 'logs') {
        const { layersToRun } = configStore.getProjectInfo();
        const logPaths = layersToRun.map(l => `${l}/${area}`).join(' ');
        const logTable = await shellService.runProjectCommandWithOutput(`du -sh ${logPaths}`);


        let totalBytes = 0;
        const lines = logTable.split('\n');
        for (const line of lines) {
            const [size] = line.trim().split(/\s+/);
            if (size) totalBytes += parseSize(size);
        }

        clm.preStep(`Total reclaimable disk space in ${area}: ${formatBytes(totalBytes)}`);

        return formatBytes(totalBytes);
    }
};