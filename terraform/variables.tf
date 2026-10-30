variable "environment" {
  description = "Deployment environment name"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging or production."
  }
}

variable "image_tag" {
  description = "Tag of the taskflow Docker image to deploy (Jenkins passes the build number)"
  type        = string
  default     = "latest"
}

variable "replicas" {
  description = "Number of application containers behind the load balancer"
  type        = number
  default     = 2

  validation {
    condition     = var.replicas >= 1 && var.replicas <= 5
    error_message = "replicas must be between 1 and 5."
  }
}

variable "external_port" {
  description = "Port on the host where the load balancer is published"
  type        = number
}

variable "app_version" {
  description = "Application version shown in the UI"
  type        = string
  default     = "1.0.0"
}

variable "build_number" {
  description = "Jenkins build number that produced the image"
  type        = string
  default     = "manual"
}

variable "git_commit" {
  description = "Git commit of the deployed code"
  type        = string
  default     = "unknown"
}

variable "memory_mb" {
  description = "Memory limit for each application container (MB)"
  type        = number
  default     = 128
}

variable "docker_host" {
  description = "Docker engine endpoint (Linux socket by default)"
  type        = string
  default     = "unix:///var/run/docker.sock"
}
