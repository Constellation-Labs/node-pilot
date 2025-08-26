#!/usr/bin/env bash
set -e

ID=$CL_TESSELATION_LAYER

echo "Using external IP $CL_EXTERNAL_IP for service $ID"

echo "Using CL_GLOBAL_L0_PEER_ID: $CL_GLOBAL_L0_PEER_ID"
echo "Using L0 peer HTTP host: $CL_L0_PEER_HTTP_HOST"
echo "Using L0 peer HTTP port: $CL_L0_PEER_HTTP_PORT"
echo "Using L0 peer id: $CL_L0_PEER_ID"

export RUN_COMMAND="run-validator"

if [ -e "/app/seedlist" ]; then
  echo "Using seedlist mapped from host"
  export RUN_COMMAND="$RUN_COMMAND --seedlist /app/seedlist"
fi

if [ -e "/app/priority-seedlist" ]; then
  echo "Using priority seedlist mapped from host"
  export RUN_COMMAND="$RUN_COMMAND --prioritySeedlist /app/priority-seedlist"
fi

export JAR_PATH="/app/jars/$ID.jar"

echo "Running $RUN_COMMAND"
RUN_LOG_FILE="/app/logs/$ID-run.log"
echo "Running command   java $CL_DOCKER_JAVA_OPTS -jar "$JAR_PATH" $RUN_COMMAND 2>&1 | tee -a $RUN_LOG_FILE"
java $CL_DOCKER_JAVA_OPTS -jar "$JAR_PATH" $RUN_COMMAND > $RUN_LOG_FILE 2>&1 | tee -a $RUN_LOG_FILE

# Capture Java’s exit code ([0] is Java; [1] is tee)
exit_code=${PIPESTATUS[0]}
echo "Exit code: $exit_code"
exit $exit_code