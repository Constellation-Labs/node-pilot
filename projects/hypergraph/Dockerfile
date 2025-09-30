FROM ubuntu:22.04

RUN apt update && apt install -y openjdk-11-jre

RUN apt install -y curl jq wget

# Install necessary dependencies for adding NodeSource repository
RUN apt-get update && apt-get install -y gnupg ca-certificates

# Import the NodeSource GPG key
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

# Add the NodeSource repository for Node.js 22
ENV NODE_MAJOR=22
RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

# Update package lists and install Node.js and npm
RUN apt-get update && apt-get install -y nodejs

# Verify the installation
RUN node -v
RUN npm -v


# Add app JARS
RUN mkdir -p /app/jars

COPY dist/keytool.jar /app/jars/keytool.jar
COPY dist/wallet.jar /app/jars/wallet.jar

COPY dist/gl1.jar /app/jars/gl1.jar
COPY dist/gl0.jar /app/jars/gl0.jar

# Add Starchiver
#RUN curl -fsSL https://raw.githubusercontent.com/StardustCollective/Starchive-Extractor/main/starchiverT3-ext.sh -o /app/starchiverT3-ext.sh
#RUN chmod +x /app/starchiverT3-ext.sh
#RUN apt-get install -y tmux tar coreutils pv bc

# Add health-check
COPY ./health-check /health-check
RUN chmod +x /health-check/bin/run.sh
RUN chmod +x /health-check/bin/hydrate.sh

# Add entrypoint
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh





WORKDIR /app

ENTRYPOINT ["/app/entrypoint.sh"]
