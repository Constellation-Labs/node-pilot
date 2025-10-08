#!/usr/bin/env bash

CPILOT=$(command -v cpilot)
if [ -z "$CPILOT" ]; then
  echo "cpilot command not found. Please ensure Node Pilot is installed and accessible in your PATH."
  exit 1
fi

WORKING_DIR=/home/$USER/.config/systemd/user

mkdir -p $WORKING_DIR

cat << EOF > $WORKING_DIR/restart-unhealthy.service
[Unit]
Description=Restart unhealthy docker containers
After=docker.service
Wants=docker.service

[Service]
ExecStart=$WORKING_DIR/restart-unhealthy.sh
Restart=always
RestartSec=60s

[Install]
WantedBy=docker.service
EOF

cat << EOF > $WORKING_DIR/restart-unhealthy.sh
#!/usr/bin/env bash
docker ps -q -f health=unhealthy | xargs --no-run-if-empty docker restart
EOF

chmod +x $WORKING_DIR/restart-unhealthy.sh

cat << EOF > $WORKING_DIR/node-pilot-autostart.service
[Unit]
Description=Constellation Network Node Auto Restart Service
After=default.target

[Service]
ExecStart=$CPILOT restart --autostart

[Install]
WantedBy=default.target
EOF

cat << EOF > $WORKING_DIR/node-pilot-update.service
[Unit]
Description=Constellation Node Pilot Updater Service
After=default.target

[Service]
ExecStart=$CPILOT restart --update
Restart=always
RestartSec=5m

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload

systemctl --user enable restart-unhealthy.service
systemctl --user enable node-pilot-autostart.service
systemctl --user enable node-pilot-update.service

systemctl --user start restart-unhealthy.service
systemctl --user start node-pilot-autostart.service
systemctl --user start node-pilot-update.service

loginctl enable-linger $USER