#!/usr/bin/env bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

PATH_LOGS=${PATH_LOGS:-"/app/logs"}

cd "$SCRIPT_DIR/../dist"

node index.js 2>&1 | tee -a $PATH_LOGS/health-check.log
exit_code=${PIPESTATUS[0]}
exit $exit_code