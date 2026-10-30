output "url" {
  value = "http://localhost:${var.external_port}"
}

output "app_containers" {
  value = docker_container.app[*].name
}

output "load_balancer" {
  value = docker_container.lb.name
}

output "network" {
  value = docker_network.this.name
}

output "data_volume" {
  value = docker_volume.data.name
}

output "image" {
  value = var.image
}
