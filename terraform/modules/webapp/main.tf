# Reusable module: a web application running as N containers behind an Nginx
# load balancer, with its own network and a persistent data volume.

resource "docker_network" "this" {
  name   = "${var.name}-net"
  driver = "bridge"

  dynamic "labels" {
    for_each = var.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_volume" "data" {
  name = "${var.name}-data"

  dynamic "labels" {
    for_each = var.labels
    content {
      label = labels.key
      value = labels.value
    }
  }
}

# The application image is built by Jenkins, so it is read from the local engine.
data "docker_image" "app" {
  name = var.image
}

resource "docker_image" "nginx" {
  name         = var.lb_image
  keep_locally = true
}

resource "docker_container" "app" {
  count = var.replicas

  name    = "${var.name}-app-${count.index + 1}"
  image   = data.docker_image.app.id
  restart = "unless-stopped"
  memory  = var.memory_mb

  env = [for k, v in merge(var.env, { INSTANCE_NO = tostring(count.index + 1) }) : "${k}=${v}"]

  networks_advanced {
    name = docker_network.this.name
  }

  volumes {
    volume_name    = docker_volume.data.name
    container_path = "/data"
  }

  healthcheck {
    test     = ["CMD", "wget", "-qO-", "http://127.0.0.1:${var.app_port}/api/health"]
    interval = "10s"
    timeout  = "3s"
    retries  = 3
  }

  # do not report success until the container is healthy
  wait         = true
  wait_timeout = 90

  dynamic "labels" {
    for_each = merge(var.labels, var.container_labels, { role = "app" })
    content {
      label = labels.key
      value = labels.value
    }
  }
}

resource "docker_container" "lb" {
  name    = "${var.name}-lb"
  image   = docker_image.nginx.image_id
  restart = "unless-stopped"

  ports {
    internal = 80
    external = var.external_port
  }

  networks_advanced {
    name = docker_network.this.name
  }

  # Nginx config is generated from the list of app containers
  upload {
    file = "/etc/nginx/conf.d/default.conf"
    content = templatefile("${path.module}/templates/nginx.conf.tftpl", {
      name      = var.name
      upstreams = docker_container.app[*].name
      app_port  = var.app_port
    })
  }

  dynamic "labels" {
    for_each = merge(var.labels, var.container_labels, { role = "load-balancer" })
    content {
      label = labels.key
      value = labels.value
    }
  }
}
