#!/scripts/bash

# Break on any error
set -e

# Check and install curl
check_curl() {
#  echo "Checking for curl..."
  if command -v curl >/dev/null 2>&1; then
    echo "✅ curl is already installed."
    return 0
  fi
  
  echo "⚠️ curl not found. Will attempt to install curl."
  
  case "$(uname)" in
    Linux)
      if command -v apt >/dev/null 2>&1; then
        echo "Installing curl using apt..."
        sudo apt update
        sudo apt install -y curl
      elif command -v yum >/dev/null 2>&1; then
        echo "Installing curl using yum..."
        sudo yum install -y curl
      else
        echo "⚠️ Unsupported Linux distribution. Please install curl manually."
        return 1
      fi
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        echo "Installing curl using Homebrew..."
        brew install curl
      else
        echo "⚠️ Homebrew not found. Please install curl manually."
        return 1
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "On Windows, please install curl manually."
      return 1
      ;;
    *)
      echo "⚠️ Unsupported OS: $(uname). Please install curl manually."
      return 1
      ;;
  esac
  
  echo "✅ curl installation complete."
  return 0
}

# Check and install Docker Engine
check_docker() {
#  echo "Checking for Docker..."
  if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker is already installed."
    return 0
  fi
  
  echo "⚠️ Docker not found. Will attempt to install Docker."
  
  case "$(uname)" in
    Linux)
      if command -v apt >/dev/null 2>&1; then
        echo "Installing Docker using script..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh ./get-docker.sh
        sudo usermod -aG docker $USER
        echo "Docker installed. You may need to log out and back in for group changes to take effect."
      else
        echo "⚠️ Unsupported Linux distribution. Please install Docker manually."
        return 1
      fi
      ;;
    Darwin)
        echo "Please install Docker Desktop manually from https://www.docker.com/products/docker-desktop"
        return 1
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "On Windows, please install Docker Desktop manually from https://www.docker.com/products/docker-desktop"
      return 1
      ;;
    *)
      echo "⚠️ Unsupported OS: $(uname). Please install Docker manually."
      return 1
      ;;
  esac
  
  echo "✅ Docker installation complete."
  return 0
}


# Run all checks
echo "🔍 Checking and installing required dependencies..."
check_curl
check_docker
