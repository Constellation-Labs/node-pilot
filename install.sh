#!/usr/bin/env bash

# Check and install Node.js
check_node() {
  echo "Checking for Node 22 or later..."
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

  if [ -d "$HOME/.nvm" ]; then
      # Install node
      nvm install 22

      # Verify installation
      echo "Node version: $(node -v)"
      echo "NPM version: $(npm -v)"
      echo "NPX version: $(npx -v)"
    return 0
  fi

  case "$(uname)" in
    Linux)
      echo "Installing Node.js using nvm..."
      # NPM
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

      # Load nvm without needing to open a new terminal
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
      [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

      # Install node
      nvm install 22

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
  if command -v cpilot >/dev/null 2>&1; then
    echo "✅ Node Pilot is already installed"
  else
    echo "Installing Node Pilot..."
    npm install -g @constellation-network/node-pilot
    echo "✅ Node Pilot installed: $(cpilot --version)"
  fi
  echo ""
  echo "Simply, run 'cpilot' to get started"
}

check_node_pilot

