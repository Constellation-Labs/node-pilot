#!/usr/bin/env bash

# Uninstall Node Pilot systemctl services and timers

CURRENT_USER=$(id -un)
if [ "$CURRENT_USER" = "root" ]; then
  IS_ROOT=true
  WORKING_DIR="/etc/systemd/system"
else
  IS_ROOT=false
  HOME_DIR=$(eval echo ~$CURRENT_USER)
  WORKING_DIR="$HOME_DIR/.config/systemd/user"
fi

SERVICES=(restart-unhealthy.timer restart-unhealthy.service node-pilot-autostart.service node-pilot-update.service)

if [ "$IS_ROOT" = true ]; then
  for SERVICE in "${SERVICES[@]}"; do
    systemctl stop "$SERVICE" 2>/dev/null
    systemctl disable "$SERVICE" 2>/dev/null
    rm -f "$WORKING_DIR/$SERVICE"
    echo "$SERVICE uninstalled."
  done
  systemctl daemon-reload
else
  for SERVICE in "${SERVICES[@]}"; do
    systemctl --user stop "$SERVICE" 2>/dev/null
    systemctl --user disable "$SERVICE" 2>/dev/null
    rm -f "$WORKING_DIR/$SERVICE"
    echo "$SERVICE uninstalled ($CURRENT_USER)."
  done
  systemctl --user daemon-reload
  # Optionally disable linger (uncomment if needed)
  loginctl disable-linger "$CURRENT_USER"
fi

echo "Node Pilot services and timers have been uninstalled."
