#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

usage() {
  echo "Usage: $0 <network>"
  echo "  network: mainnet | testnet | intnet | integrationnet"
  exit 1
}

require() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || { echo "Error: '$cmd' is required"; exit 1; }
}

NETWORK="${1:-}"
[[ -z "${NETWORK}" ]] && { echo "No network specified."; usage; }

case "$NETWORK" in
  mainnet|testnet|integrationnet) ;;
  intnet) NETWORK="integrationnet" ;;
  *) echo "Invalid network: $NETWORK"; usage ;;
esac

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Set variables
REPO="Constellation-Labs/tessellation"
ASSETS=("cl-node.jar" "cl-dag-l1.jar" "cl-keytool.jar" "cl-wallet.jar" "mainnet-seedlist") # "currency-l1.jar" "metagraph-l0.jar")
ASSET_NAMES=("gl0.jar" "gl1.jar" "keytool.jar" "wallet.jar" "seedlist")
OUTPUT_DIR="$SCRIPT_DIR/../dist"   # Directory to save the downloaded assets

# load the version from the version file
if [ -f "$OUTPUT_DIR/version.sh" ]; then
  source "$OUTPUT_DIR/version.sh"
  # if argument NETWORK is different from current RELEASE_NETWORK, force download of latest release
  if [ -n "$NETWORK" ] && [ "$NETWORK" != "$RELEASE_NETWORK_TYPE" ]; then
    echo "Changing network from $RELEASE_NETWORK_TYPE to $NETWORK"
    RELEASE_NETWORK_TYPE=""
    rm -rf $OUTPUT_DIR
  else
    NETWORK="$RELEASE_NETWORK_TYPE"
  fi
else
  bash "$SCRIPT_DIR/install-dependencies.sh"
  RELEASE_NETWORK_TYPE=""
fi

require curl
require jq

# Check network version
# Resolve the load balancer URL based on the network and get the release tag
LB_HTTP="https://l0-lb-$NETWORK.constellationnetwork.io"
RELEASE=$(curl -s $LB_HTTP/node/info | jq -r '.version')
RELEASE_TAG="v$RELEASE"

if [ -n "$RELEASE_NETWORK_TYPE" ] && [ "$RELEASE" != "$RELEASE_NETWORK_VERSION" ]; then
  echo "Current release version ($RELEASE) is different from the version in the version file ($RELEASE_NETWORK_VERSION)."
  RELEASE_NETWORK_TYPE=""
  rm -rf $OUTPUT_DIR
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

NETWORK_UC=$(echo "$NETWORK" | tr '[:lower:]' '[:upper:]')

if [ -n "$RELEASE_NETWORK_TYPE" ]; then
  echo "Already using the latest release $NETWORK_UC :: $RELEASE"
  exit 0
fi

echo "Installing latest release: $NETWORK_UC :: $RELEASE"


# Resolve the tessellation release download URL based on the network
if [ "$NETWORK" == "testnet" ]; then
  DOWNLOAD_URL_PREFIX="https://constellationlabs-dag.s3.us-west-1.amazonaws.com/testnet/tessellation/$RELEASE"
else
  DOWNLOAD_URL_PREFIX="https://github.com/Constellation-Labs/tessellation/releases/download/$RELEASE_TAG"
fi

DOWNLOAD_URL="$DOWNLOAD_URL_PREFIX/${ASSETS[0]}"

# check if first file exists at url
if ! curl --output /dev/null --silent --head --fail "$DOWNLOAD_URL"; then
  echo "Error: '$DOWNLOAD_URL' does not exist in the repository."
  exit 1
fi

download_asset() {
  ASSET_NAME="$1"
  OUTPUT_NAME="$2"

  # Get the asset download URL
  DOWNLOAD_URL="$DOWNLOAD_URL_PREFIX/$ASSET_NAME"

  # Download the asset
  echo "$ASSET_NAME -> $OUTPUT_NAME"
  curl -# -L -H "Accept: application/octet-stream" -o "$OUTPUT_DIR/$OUTPUT_NAME" "$DOWNLOAD_URL"

  if [ $? -ne 0 ]; then
    echo "Failed to download asset '$ASSET_NAME'."
    return 1
  fi
}

# Download each asset
for i in "${!ASSETS[@]}"; do
  # skip mainnet seedlist if off-mainnet
  if [ "$NETWORK" != "mainnet" ] && [ "${ASSETS[i]}" = "mainnet-seedlist" ]; then
    continue
  fi
  download_asset "${ASSETS[i]}" "${ASSET_NAMES[i]}"
done


# if network is testnet or intnet get seedlist
if [ "$NETWORK" == "testnet" ] || [ "$NETWORK" == "integrationnet" ]; then
  SEEDLIST_URL="https://constellationlabs-dag.s3.us-west-1.amazonaws.com/$NETWORK-seedlist"
  # Download the seedlist text file and name it "seedlist"
  curl -s -L -H "Accept: application/octet-stream" -o "$OUTPUT_DIR/seedlist" "$SEEDLIST_URL"
  if [ $? -ne 0 ]; then
    echo "Failed to download seedlist from '$SEEDLIST_URL'."
    exit 1
  fi
  echo "$NETWORK-seedlist -> seedlist"
fi

# move seedlist to project root
if [ -f "$OUTPUT_DIR/seedlist" ]; then
  mv "$OUTPUT_DIR/seedlist" "$OUTPUT_DIR/../seedlist"
fi

write_version_file() {
  local tmp
  tmp="$(mktemp "${OUTPUT_DIR}/version.sh.XXXX")"
  {
    echo "RELEASE_NETWORK_TYPE=\"${NETWORK}\""
    echo "RELEASE_NETWORK_VERSION=\"${RELEASE}\""
  } > "$tmp"
  chmod 0644 "$tmp"
  mv "$tmp" "${OUTPUT_DIR}/version.sh"
}

write_version_file
