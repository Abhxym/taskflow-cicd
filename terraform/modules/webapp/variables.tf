variable "name" {
  description = "Prefix used for every resource name"
  type        = string
}

variable "image" {
  description = "Application image (must exist in the local Docker engine)"
  type        = string
}

variable "replicas" {
  description = "Number of application containers"
  type        = number
  default     = 1
}

variable "app_port" {
  description = "Port the application listens on inside the container"
  type        = number
  default     = 3000
}

variable "external_port" {
  description = "Host port for the load balancer"
  type        = number
}

variable "memory_mb" {
  description = "Memory limit per application container (MB)"
  type        = number
  default     = 128
}

variable "env" {
  description = "Environment variables passed to the application"
  type        = map(string)
  default     = {}
}

variable "labels" {
  description = "Labels added to every resource"
  type        = map(string)
  default     = {}
}

variable "lb_image" {
  description = "Image used for the load balancer"
  type        = string
  default     = "nginx:1.27-alpine"
}
