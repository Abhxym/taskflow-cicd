output "app_url" {
  description = "URL of the load balancer for this environment"
  value       = module.taskflow.url
}

output "app_containers" {
  description = "Names of the application containers"
  value       = module.taskflow.app_containers
}

output "load_balancer" {
  description = "Name of the load balancer container"
  value       = module.taskflow.load_balancer
}

output "network" {
  description = "Docker network created for this environment"
  value       = module.taskflow.network
}

output "data_volume" {
  description = "Docker volume that stores the tasks"
  value       = module.taskflow.data_volume
}

output "deployed_image" {
  description = "Image deployed to this environment"
  value       = module.taskflow.image
}
