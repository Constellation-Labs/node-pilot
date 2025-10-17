#!/usr/bin/env bash

# Check and install Node.js
check_node() {
  if command -v node >/dev/null 2>&1; then
      NODE_VERSION=$(node -v | sed 's/v//;s/\..*//')  # Extract major version number
      if [ "$NODE_VERSION" -ge 22 ]; then
          echo "✅ Node.js version $NODE_VERSION is already installed."
          return 0
      else
          echo "⚠️ Node.js version $NODE_VERSION is installed, but version 22 or later is required."
          echo "Would you like to update Node.js now? (y/n)"
          read -r response
          if [[ ! "$response" =~ ^[Yy]$ ]]; then
              echo "Node.js update skipped. Please update Node.js manually to proceed."
              return 1
          fi
      fi
  else
    echo "⚠️ Node.js 22 is required but not found."
    echo "Would you like to install Node.js now? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
      echo "Node.js installation skipped. Please install Node.js manually to proceed."
      return 1
    fi
  fi

  install_node

  return $?
}

install_node() {

  case "$(uname)" in
    Linux)
      echo "Installing Node.js..."

       curl -sL https://deb.nodesource.com/setup_22.x | sudo bash
       sudo apt-get install nodejs -y

      # Verify installation
      echo "Node version: $(node -v)"
      echo "NPM version: $(npm -v)"
      echo "NPX version: $(npx -v)"
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        echo "Installing Node.js using Homebrew..."
        brew install node
      else
        echo "⚠️ Homebrew not found. Please install Node.js manually."
        return 1
      fi
      ;;
    *)
      echo "⚠️ No Node.js installation available for this OS: $(uname)"
      return 1
      ;;
  esac

  echo "✅ Node.js installation complete."
  return 0
}

DOCKER_INSTALLED=false

# Check and install Docker Engine
check_docker() {
#  echo "Checking for Docker..."
  if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker is already installed."
    return 0
  fi

  echo ""
  echo "⚠️ Docker not found. Will attempt to install Docker."
  echo ""

  case "$(uname)" in
    Linux)
      echo "Installing Docker using script..."
      curl -fsSL https://get.docker.com | sudo sh
      sudo usermod -aG docker $USER
      export DOCKER_INSTALLED=true
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

check_system_update() {
  echo ""
  echo "Checking for system updates..."
  echo ""

  if [ "$(uname)" = "Linux" ]; then
    sudo apt-get update && sudo apt-get upgrade -y
    echo "System packages updated."
  fi
}

check_node_pilot() {
  if ! check_node; then
    return
  fi
  echo "Installing Node Pilot..."
  sudo npm install -g @constellation-network/node-pilot@latest
  echo "✅ Node Pilot installed: $(cpilot --version)"
}

check_node_pilot
check_docker
check_system_update

if [ -f /var/run/reboot-required ]; then
  echo ""
  echo "⚠️ A system reboot is required to complete updates. Please reboot your system."
  echo ""
  echo "Then run 'cpilot' to get started"
  echo ""
  echo "Would you like to reboot now? (y/n)"
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Reboot skipped. Please reboot manually to proceed."
  else
    sudo reboot
  fi
elif [ "$DOCKER_INSTALLED" = true ]; then
  echo ""
  echo "⚠️ Log out and log back in for Docker permissions to take effect."
  echo "Then run 'cpilot' to get started"
else
  echo ""
  echo "Run 'cpilot' to get started"
fi
