#!/usr/bin/env bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
OUTPUT_DIR="$SCRIPT_DIR/../dist"   # Directory to save the downloaded assets

# load the version from the version file
if [ -f "$OUTPUT_DIR/version.sh" ]; then
  source "$OUTPUT_DIR/version.sh"
else
  echo "No version file found."
  exit 1;
fi

if [ -n "${NODE_URL:-}" ]; then
  LB_HTTP="$NODE_URL"
else
  LB_HTTP="https://l0-lb-$INSTALLED_NETWORK_TYPE.constellationnetwork.io"
fi

echo "Checking version at $LB_HTTP"
# Check network version
# Resolve the load balancer URL based on the network and get the release tag
CLUSTER_NETWORK_VERSION=$(curl -s $LB_HTTP/node/info | jq -r '.version')

if [ "$INSTALLED_NETWORK_VERSION" != "$CLUSTER_NETWORK_VERSION" ]; then
  echo "Installed version: $INSTALLED_NETWORK_VERSION"
  echo "Cluster version:   $CLUSTER_NETWORK_VERSION"
  exit 1
fi

echo "Version: $INSTALLED_NETWORK_VERSION"