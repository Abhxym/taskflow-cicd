# TaskFlow - Jenkins CI/CD and Terraform

Assignment: CI/CD with Jenkins and Infrastructure as Code with Terraform
Name: Abhay Maurya | PRN: 202301040187 | Course: CND (MDM)

TaskFlow is a task board web app (Node.js, no external packages). A Jenkins pipeline tests it, builds a Docker image and deploys it with Terraform to a staging and a production environment.

![TaskFlow](docs/screenshots/app-production.png)

## Pipeline

```
Checkout -> Unit Tests -> Build Image -> Container Test -> Terraform Validate
         -> Deploy to Staging -> Smoke Test Staging -> Approval
         -> Deploy to Production -> Smoke Test Production
```

- Jenkins checks GitHub every 2 minutes (Poll SCM) and starts a build when there is a new commit.
- Unit and API tests run inside the Docker build. The JUnit report is published in Jenkins.
- The image is tagged with the Jenkins build number and contains the commit id.
- Terraform deploys the image to staging (2 replicas, port 8081) and, after manual approval, to production (3 replicas, port 8082).

## Terraform

```
terraform/
  versions.tf  providers.tf  variables.tf  main.tf  outputs.tf
  environments/dev.tfvars  staging.tfvars  production.tfvars
  modules/webapp/          reusable module
    main.tf  variables.tf  outputs.tf  versions.tf
    templates/nginx.conf.tftpl
```

The `webapp` module creates, for each environment: a Docker network, a data volume, N application containers with health checks and memory limits, and an Nginx load balancer whose config is generated from the container list. Provider: `kreuzwerker/docker`. Each environment uses its own Terraform workspace.

Run it by hand (dev environment, Windows):

```
cd terraform
terraform init
terraform plan  -var-file=environments/dev.tfvars -var docker_host=npipe:////./pipe/docker_engine
terraform apply -var-file=environments/dev.tfvars -var docker_host=npipe:////./pipe/docker_engine
terraform output
terraform destroy -var-file=environments/dev.tfvars -var docker_host=npipe:////./pipe/docker_engine
```

## Jenkins

Jenkins runs in Docker and is configured as code:

- `jenkins/Dockerfile` - Jenkins LTS + Docker CLI + Terraform + plugins
- `jenkins/plugins.txt` - Pipeline, Git, GitHub, JUnit, Stage View, Configuration as Code, Job DSL, ...
- `jenkins/casc.yaml` - admin user, security and the `taskflow-pipeline` job (Pipeline script from SCM)

```
cp jenkins/.env.example jenkins/.env      # set the admin password
docker compose -f jenkins/docker-compose.yml up -d --build
```

Jenkins: http://localhost:8085

## App

```
npm test            # 14 tests
npm start           # http://localhost:3000
```

API: `GET /api/health`, `GET /api/info`, `GET|POST /api/tasks`, `PATCH|DELETE /api/tasks/:id`

| URL | Environment |
|---|---|
| http://localhost:8081 | staging |
| http://localhost:8082 | production |
| http://localhost:8083 | dev (manual Terraform) |
