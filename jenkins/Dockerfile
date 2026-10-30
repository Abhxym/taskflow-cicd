# Jenkins controller for the TaskFlow pipeline.
# Adds the Docker CLI and Terraform so pipeline stages can build images
# and provision infrastructure. Plugins and the job are set up as code.
FROM jenkins/jenkins:lts-jdk17

USER root

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl unzip ca-certificates git && \
    rm -rf /var/lib/apt/lists/*

# Docker CLI only (the Docker engine of the host is used through the socket)
ARG DOCKER_VERSION=27.5.1
RUN curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz" \
      | tar -xz -C /tmp && mv /tmp/docker/docker /usr/local/bin/docker && rm -rf /tmp/docker

# Terraform CLI
ARG TERRAFORM_VERSION=1.17.1
RUN curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" \
      -o /tmp/terraform.zip && unzip -q /tmp/terraform.zip terraform -d /usr/local/bin && rm /tmp/terraform.zip

# Plugins
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

# Configuration as Code (users, security, the pipeline job)
COPY casc.yaml /usr/share/jenkins/ref/casc.yaml
ENV CASC_JENKINS_CONFIG=/usr/share/jenkins/ref/casc.yaml \
    JAVA_OPTS="-Djenkins.install.runSetupWizard=false"
