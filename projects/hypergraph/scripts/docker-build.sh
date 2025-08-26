# --- resolve script dir ---
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# --- build image ---
DOCKER_IMAGE_VERSION="${DOCKER_IMAGE_VERSION:-test}"
echo "Building tessellation image: constellationnetwork/tessellation:$DOCKER_IMAGE_VERSION"
docker build -t "constellationnetwork/tessellation:$DOCKER_IMAGE_VERSION" -f "$SCRIPT_DIR/../Dockerfile" .