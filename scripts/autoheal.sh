#!/usr/bin/env bash
# This script monitors Docker containers and restarts any that are unhealthy.

unhealthy_containers=$(docker ps -q --filter health=unhealthy)
if [ -n "$unhealthy_containers" ]; then
  echo "Restarting unhealthy containers: $unhealthy_containers"
  docker restart $unhealthy_containers
fi