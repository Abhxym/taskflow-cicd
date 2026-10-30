# Root module: deploys one TaskFlow environment using the reusable webapp module.

locals {
  # Labels on the network and volume must stay the same between deployments,
  # because changing a label forces Docker to recreate the resource (and the
  # volume holds the task data). The build number is only put on containers.
  common_labels = {
    project     = "taskflow"
    environment = var.environment
    managed_by  = "terraform"
  }
}

module "taskflow" {
  source = "./modules/webapp"

  name          = "taskflow-${var.environment}"
  image         = "taskflow:${var.image_tag}"
  replicas      = var.replicas
  external_port = var.external_port
  memory_mb     = var.memory_mb
  labels        = local.common_labels

  container_labels = {
    build = var.build_number
  }

  env = {
    DEPLOY_ENV   = var.environment
    APP_VERSION  = var.app_version
    BUILD_NUMBER = var.build_number
    GIT_COMMIT   = var.git_commit
  }
}
