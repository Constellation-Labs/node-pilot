#!/usr/bin/env bash
set -e

# check for valid arguments
if [ -z "$ORDINAL" ]; then
  echo "Usage: $0 <ordinal>"
  exit 1
fi

if [ -f  "/app/starchiverT3-ext.sh" ]; then
  echo "Running /app/starchiverT3-ext.sh --data-path /app/data --cluster $CL_APP_ENV --datetime $ORDINAL -o --nocleanup"
  /app/starchiverT3-ext.sh --data-path /app/data --cluster $CL_APP_ENV --datetime $ORDINAL -o --nocleanup &
  echo $! > /app/hydrate.pid
else
  echo "Starchiver not found!"
  exit 1
fi