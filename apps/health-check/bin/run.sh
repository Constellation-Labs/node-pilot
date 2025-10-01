#!/usr/bin/env bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPT_DIR=$( cd -- "$( dirname -- "$SCRIPT_PATH" )" &> /dev/null && pwd )

PATH_LOGS=${PATH_LOGS:-"/app/logs"}

cd "$SCRIPT_DIR/../dist"

node index.js 2>&1 | tee -a $PATH_LOGS/health-check.log
exit_code=${PIPESTATUS[0]}
exit $exit_code