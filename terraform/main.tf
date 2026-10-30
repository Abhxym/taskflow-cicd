# Root module: deploys one TaskFlow environment using the reusable webapp module.

locals {
  common_labels = {
    project     = "taskflow"
    environment = var.environment
    managed_by  = "terraform"
    build       = var.build_number
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

  env = {
    DEPLOY_ENV   = var.environment
    APP_VERSION  = var.app_version
    BUILD_NUMBER = var.build_number
    GIT_COMMIT   = var.git_commit
  }
}
