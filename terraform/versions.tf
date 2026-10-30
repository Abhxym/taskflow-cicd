terraform {
  required_version = ">= 1.6.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.6"
    }
  }

  # State is stored locally. The path is set with -backend-config
  # (Jenkins keeps it in /var/jenkins_home/tfstate so it survives workspace cleanup).
  backend "local" {}
}
