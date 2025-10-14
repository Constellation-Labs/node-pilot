#!/usr/bin/env bash
set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd "$SCRIPT_DIR/../dist"

PATH_LOGS=${PATH_LOGS:-"/app/logs"}

node hydrate.js >> $PATH_LOGS/hydrate.log 2>&1 &
pid=$!
echo "$pid"

#sleep 0.5
#if ! ps -p $pid > /dev/null
#then
#  wait "$pid"
#  EXIT_STATUS=$?
#  if [ $EXIT_STATUS -eq 0 ]; then
#    echo "Hydrate completed successfully."
#  else
#    echo "Hydrate failed with exit code $EXIT_STATUS."
#    exit $EXIT_STATUS
#  fi
#fi

