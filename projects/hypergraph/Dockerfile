FROM openjdk:11-jre-slim
#FROM ubuntu:22.04

#RUN apt update && apt install -y openjdk-11-jre

RUN apt update && apt install -y \
    curl \
    jq \
    wget

# Dev tools
#RUN apt install -y curl iproute2 iputils-ping jq software-properties-common gnupg2
#
## Prepare for Node.js 20  installation
#RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/nodesource.gpg >/dev/null && \
#    echo "deb [signed-by=/etc/apt/trusted.gpg.d/nodesource.gpg] https://deb.nodesource.com/node_20.x focal main" | tee /etc/apt/sources.list.d/nodesource.list
#
## Update package lists again and install Node.js
#RUN apt update && apt install -y nodejs


RUN mkdir -p /app/jars

COPY dist/keytool.jar /app/jars/keytool.jar
COPY dist/wallet.jar /app/jars/wallet.jar

COPY dist/gl1.jar /app/jars/gl1.jar
COPY dist/gl0.jar /app/jars/gl0.jar

COPY ./entrypoint.sh /app/entrypoint.sh

#COPY ../apps/health-check /health-check

RUN chmod +x /app/entrypoint.sh

WORKDIR /app

ENTRYPOINT ["/app/entrypoint.sh"]
