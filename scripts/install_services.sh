#!/usr/bin/env bash

# Find cpilot in PATH
CPILOT=$(command -v cpilot)
if [ -z "$CPILOT" ]; then
  echo "cpilot command not found. Please ensure Node Pilot is installed and accessible in your PATH."
  exit 1
fi

# Get current user and home directory reliably
CURRENT_USER=$(id -un)
if [ "$CURRENT_USER" = "root" ]; then
  IS_ROOT=true
  WORKING_DIR="/etc/systemd/system"
  HOME_DIR="/root"
  UNIT_TARGET="multi-user.target"
else
  IS_ROOT=false
  HOME_DIR=$(eval echo ~$CURRENT_USER)
  WORKING_DIR="$HOME_DIR/.config/systemd/user"
  UNIT_TARGET="default.target"
fi

BIN_DIRECTORY="$HOME_DIR/.node-pilot/scripts"

mkdir -p "$BIN_DIRECTORY"

# Create working directory if it doesn't exist
mkdir -p "$WORKING_DIR"

# Create restart-unhealthy.service
cat << EOF > "$WORKING_DIR/restart-unhealthy.service"
[Unit]
Description=Restart unhealthy docker containers
After=docker.service
Wants=docker.service

[Service]
Type=oneshot
ExecStart=$BIN_DIRECTORY/restart-unhealthy.sh
EOF

# Create restart-unhealthy.timer
cat <<EOF > "$WORKING_DIR/restart-unhealthy.timer"
[Unit]
Description=Run docker unhealthy restart every 5 minutes
Requires=restart-unhealthy.service
After=docker.service
Wants=docker.service

[Timer]
OnCalendar=*:0/1
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Create restart-unhealthy.sh
cat << EOF > "$BIN_DIRECTORY/restart-unhealthy.sh"
#!/usr/bin/env bash
docker ps -q -f health=unhealthy | xargs --no-run-if-empty docker restart
EOF

chmod +x "$BIN_DIRECTORY/restart-unhealthy.sh"

# Create node-pilot-autostart.service
cat << EOF > "$WORKING_DIR/node-pilot-autostart.service"
[Unit]
Description=Constellation Network Node Auto Restart Service
After=$UNIT_TARGET

[Service]
ExecStart=cpilot restart --autostart

[Install]
WantedBy=$UNIT_TARGET
EOF

# Create node-pilot-update.service
cat << EOF > "$WORKING_DIR/node-pilot-update.service"
[Unit]
Description=Constellation Node Pilot Updater Service
After=$UNIT_TARGET

[Service]
ExecStart=cpilot restart --update
Restart=always
RestartSec=5m

[Install]
WantedBy=$UNIT_TARGET
EOF

# Enable and start services/timers
if [ "$IS_ROOT" = true ]; then
  systemctl daemon-reload
  systemctl enable restart-unhealthy.timer
  systemctl enable node-pilot-autostart.service
  systemctl enable node-pilot-update.service

  systemctl start restart-unhealthy.timer
  systemctl start node-pilot-autostart.service
  systemctl start node-pilot-update.service
else
  systemctl --user daemon-reload
  systemctl --user enable restart-unhealthy.timer
  systemctl --user enable node-pilot-autostart.service
  systemctl --user enable node-pilot-update.service

  systemctl --user start restart-unhealthy.timer
  systemctl --user start node-pilot-autostart.service
  systemctl --user start node-pilot-update.service

  # Enable linger for the user to allow user services to run without login
  loginctl enable-linger "$CURRENT_USER"
fi
#systemctl --user status node-pilot-update.service
#  systemctl --user status restart-unhealthy