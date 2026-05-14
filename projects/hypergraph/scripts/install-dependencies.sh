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

# Check and install Java. Version is controlled by the JAVA_VERSION env
# var (default 21). For mainnet (JAVA_VERSION=11), accept any existing
# Java install — host utilities (keytool.jar, wallet.jar) work fine on
# 11 or newer, so don't force-upgrade users who already have a JDK.
check_java() {
  JAVA_VERSION="${JAVA_VERSION:-21}"

  if command -v java >/dev/null 2>&1; then
    java_version_str=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')

    if [[ "$JAVA_VERSION" == "11" ]]; then
      # Mainnet: accept whatever's installed (don't force-upgrade)
      echo "✅ Java is installed: $java_version_str (mainnet — keeping existing JDK)"
      return 0
    fi

    if [[ "$java_version_str" == "$JAVA_VERSION"* ]] || [[ "$java_version_str" == "1.$JAVA_VERSION"* ]]; then
      echo "✅ Java $JAVA_VERSION is installed."
      return 0
    fi

    echo "⚠️ Java is installed but not version $JAVA_VERSION. Will attempt to install Java $JAVA_VERSION."
  else
    echo "⚠️ Java not found. Will attempt to install Java $JAVA_VERSION."
  fi


  case "$(uname)" in
    Linux)
      if command -v apt >/dev/null 2>&1; then
        echo "Installing Java $JAVA_VERSION using apt..."
        sudo apt install -y "openjdk-${JAVA_VERSION}-jdk"
      elif command -v yum >/dev/null 2>&1; then
        echo "Installing Java $JAVA_VERSION using yum..."
        sudo yum install -y "java-${JAVA_VERSION}-openjdk-devel"
      else
        echo "⚠️ Unsupported Linux distribution. Please install Java $JAVA_VERSION manually."
        return 1
      fi
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        echo "Installing Java $JAVA_VERSION using Homebrew..."
        brew install --cask "temurin@${JAVA_VERSION}"
      else
        echo "⚠️ Homebrew not found. Please install Java $JAVA_VERSION manually."
        return 1
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "On Windows, please install Java $JAVA_VERSION manually from https://adoptium.net/"
      return 1
      ;;
    *)
      echo "⚠️ Unsupported OS: $(uname). Please install Java $JAVA_VERSION manually."
      return 1
      ;;
  esac

  echo "✅ Java $JAVA_VERSION installation complete."
  return 0
}

# Check and install jq
check_jq() {
#  echo "Checking for jq..."
  if command -v jq >/dev/null 2>&1; then
    echo "✅ jq is already installed."
    return 0
  fi
  
  echo "⚠️ jq not found. Will attempt to install jq."
  
  case "$(uname)" in
    Linux)
      if command -v apt >/dev/null 2>&1; then
        echo "Installing jq using apt..."
        sudo apt install -y jq
      elif command -v yum >/dev/null 2>&1; then
        echo "Installing jq using yum..."
        sudo yum install -y jq
      else
        echo "⚠️ Unsupported Linux distribution. Please install jq manually."
        return 1
      fi
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        echo "Installing jq using Homebrew..."
        brew install jq
      else
        echo "⚠️ Homebrew not found. Please install jq manually."
        return 1
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "On Windows, please install jq manually from https://stedolan.github.io/jq/download/"
      return 1
      ;;
    *)
      echo "⚠️ Unsupported OS: $(uname). Please install jq manually."
      return 1
      ;;
  esac
  
  echo "✅ jq installation complete."
  return 0
}

# Check and install wget
check_wget() {
#  echo "Checking for wget..."
  if command -v wget >/dev/null 2>&1; then
    echo "✅ wget is already installed."
    return 0
  fi
  
  echo "⚠️ wget not found. Will attempt to install wget."
  
  case "$(uname)" in
    Linux)
      if command -v apt >/dev/null 2>&1; then
        echo "Installing wget using apt..."
        sudo apt update
        sudo apt install -y wget
      elif command -v yum >/dev/null 2>&1; then
        echo "Installing wget using yum..."
        sudo yum install -y wget
      else
        echo "⚠️ Unsupported Linux distribution. Please install wget manually."
        return 1
      fi
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        echo "Installing wget using Homebrew..."
        brew install wget
      else
        echo "⚠️ Homebrew not found. Please install wget manually."
        return 1
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "On Windows, please install wget manually."
      return 1
      ;;
    *)
      echo "⚠️ Unsupported OS: $(uname). Please install wget manually."
      return 1
      ;;
  esac
  
  echo "✅ wget installation complete."
  return 0
}

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


# Run all checks
echo "🔍 Checking and installing required dependencies..."
check_java
check_java_home
check_jq
check_wget
check_curl

echo "All dependency checks completed."
