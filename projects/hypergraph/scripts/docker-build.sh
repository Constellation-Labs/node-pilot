# --- resolve script dir ---
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# --- build image ---
DOCKER_IMAGE_VERSION="${DOCKER_IMAGE_VERSION:-test}"
JAVA_VERSION="${JAVA_VERSION:-21}"
echo "Building tessellation image: constellationnetwork/tessellation:$DOCKER_IMAGE_VERSION (Java $JAVA_VERSION)"
docker build --build-arg JAVA_VERSION="$JAVA_VERSION" -t "constellationnetwork/tessellation:$DOCKER_IMAGE_VERSION" -f "$SCRIPT_DIR/../Dockerfile" .