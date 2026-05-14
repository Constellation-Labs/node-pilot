#!/usr/bin/env bash

# Break on any error
set -e


check_java_home() {
#    echo "Checking if JAVA_HOME env is set"

  if [ -z "$JAVA_HOME" ] || ! grep -q 'JAVA_HOME' "$HOME/.bashrc"; then
        JAVA_HOME_LINE='export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(which java)")")")"'
        echo "JAVA_HOME is not set. Attempting to set automatically"
        echo "Please ensure the following line is in your ~/.bashrc or ~/.zshrc file:"
        echo "Script will attempt to now add it for you and run it, but this only adds to .bashrc"
        echo $JAVA_HOME_LINE
        echo "$JAVA_HOME_LINE" >> $HOME/.bashrc
        echo "Adding JAVA_HOME to current environment"
        eval $JAVA_HOME_LINE
        echo "JAVA_HOME is now set to: $JAVA_HOME"
    fi
    
}

# Check and install Java 21
check_java() {
#  echo "Checking for Java 21..."
  if command -v java >/dev/null 2>&1; then
    java_version=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
#    echo "Found Java version: $java_version"
    if [[ "$java_version" == 21* ]] || [[ "$java_version" == 1.21* ]]; then
      echo "✅ Java 21 is installed."
      return 0
    else
      echo "⚠️ Java is installed but not version 21. Will attempt to install Java 21."
    fi
  else
    echo "⚠️ Java not found. Will attempt to install Java 21."
  fi

  
  case "$(uname)" in
    Linux)
      if command -v apt >/dev/null 2>&1; then
        echo "Installing Java 21 using apt..."
        sudo apt install -y openjdk-21-jdk
      elif command -v yum >/dev/null 2>&1; then
        echo "Installing Java 21 using yum..."
        sudo yum install -y java-21-openjdk-devel
      else
        echo "⚠️ Unsupported Linux distribution. Please install Java 21 manually."
        return 1
      fi
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        echo "Installing Java 21 using Homebrew..."
        brew tap adoptopenjdk/openjdk
        brew install --cask adoptopenjdk21
      else
        echo "⚠️ Homebrew not found. Please install Java 21 manually."
        return 1
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "On Windows, please install Java 21 manually from https://adoptopenjdk.net/"
      return 1
      ;;
    *)
      echo "⚠️ Unsupported OS: $(uname). Please install Java 21 manually."
      return 1
      ;;
  esac
  
  echo "✅ Java 21 installation complete."
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

check_system_update
check_java
check_java_home

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
else
  echo ""
  echo "Run 'cpilot' to get started"
fi

