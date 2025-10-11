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

check_node_pilot() {
  if ! check_node; then
    return
  fi
  echo "Installing Node Pilot..."
  sudo npm install -g @constellation-network/node-pilot@latest
  echo "✅ Node Pilot installed: $(cpilot --version)"
  echo ""
  echo "Simply, run 'cpilot' to get started"
}

check_node_pilot

