
export const githubHelper = {

    hasAssetInRelease (assetName: string, repo: string): Promise<boolean> {
        return fetch(`https://api.github.com/repos/${repo}/releases/latest`)
            .then(async res => {
                if (res.ok) {
                    const json: { assets: { name: string }[] } = await res.json();
                    return json.assets.some(a => a.name.includes(assetName))
                }

                return false;
            })
            .catch(()=> false)
    }
}