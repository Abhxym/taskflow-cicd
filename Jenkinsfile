// TaskFlow CI/CD pipeline
// Checkout -> Unit tests -> Build image -> Container test -> Terraform validate
// -> Deploy staging -> Smoke test -> Approval -> Deploy production -> Smoke test

pipeline {
    agent any

    options {
        timestamps()
        ansiColor('xterm')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        booleanParam(name: 'DEPLOY_TO_PRODUCTION', defaultValue: true,
                     description: 'Ask for approval and deploy to production after staging passes')
    }

    environment {
        APP_NAME            = 'taskflow'
        IMAGE_TAG           = "${env.BUILD_NUMBER}"
        CI_NETWORK          = 'ci-net'
        TF_IN_AUTOMATION    = '1'
        TF_INPUT            = '0'
        TF_PLUGIN_CACHE_DIR = '/var/jenkins_home/.terraform.d/plugin-cache'
        TF_STATE_DIR        = '/var/jenkins_home/tfstate/taskflow'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHORT   = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.APP_VERSION = sh(script: "grep -m1 '\"version\"' package.json | cut -d'\"' -f4", returnStdout: true).trim()
                    currentBuild.description = "v${env.APP_VERSION} (${env.GIT_SHORT})"
                }
                sh 'git log -1 --pretty="Commit %h by %an: %s"'
                echo "Building ${APP_NAME} version ${env.APP_VERSION}, build #${env.BUILD_NUMBER}"
            }
        }

        stage('Unit Tests') {
            steps {
                // tests run inside the "test" stage of the Dockerfile
                sh 'docker build --target test -t ${APP_NAME}-test:${IMAGE_TAG} .'
                sh '''
                    docker create --name ${APP_NAME}-results-${IMAGE_TAG} ${APP_NAME}-test:${IMAGE_TAG}
                    docker cp ${APP_NAME}-results-${IMAGE_TAG}:/src/test-results.xml test-results.xml
                    docker rm ${APP_NAME}-results-${IMAGE_TAG}
                '''
            }
            post {
                always {
                    junit 'test-results.xml'
                }
            }
        }

        stage('Build Image') {
            steps {
                sh '''
                    docker build \
                      --build-arg APP_VERSION=${APP_VERSION} \
                      --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                      --build-arg GIT_COMMIT=${GIT_SHORT} \
                      -t ${APP_NAME}:${IMAGE_TAG} -t ${APP_NAME}:latest .
                '''
                sh 'docker image ls ${APP_NAME} --format "table {{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.Size}}" | head -5'
            }
        }

        stage('Container Test') {
            steps {
                sh '''
                    docker run -d --name ${APP_NAME}-ci-${IMAGE_TAG} --network ${CI_NETWORK} ${APP_NAME}:${IMAGE_TAG}
                    URL=http://${APP_NAME}-ci-${IMAGE_TAG}:3000

                    echo "Waiting for the container to start..."
                    for i in $(seq 1 20); do
                      curl -fs $URL/api/health > /dev/null && break
                      sleep 1
                    done

                    echo "--- health"; curl -fsS $URL/api/health; echo
                    echo "--- build info"; curl -fsS $URL/api/info | tee info.json; echo
                    grep -q "\\"build\\":\\"${BUILD_NUMBER}\\"" info.json

                    echo "--- create a task through the API"
                    curl -fsS -X POST -H "Content-Type: application/json" \
                         -d '{"title":"Pipeline test task","priority":"high","tag":"CI"}' $URL/api/tasks; echo
                    curl -fsS $URL/api/tasks | grep -q "Pipeline test task"

                    echo "--- invalid input must be rejected"
                    CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"title":""}' $URL/api/tasks)
                    test "$CODE" = "400"
                    echo "Container test passed"
                '''
            }
            post {
                always {
                    sh 'docker rm -f ${APP_NAME}-ci-${IMAGE_TAG} || true'
                }
            }
        }

        stage('Terraform Validate') {
            steps {
                dir('terraform') {
                    sh 'mkdir -p ${TF_PLUGIN_CACHE_DIR} ${TF_STATE_DIR}'
                    sh 'terraform version'
                    sh 'terraform fmt -check -recursive'
                    sh 'terraform init -no-color -backend-config="path=${TF_STATE_DIR}/default.tfstate" -backend-config="workspace_dir=${TF_STATE_DIR}"'
                    sh 'terraform validate -no-color'
                }
            }
        }

        stage('Deploy to Staging') {
            steps {
                deploy('staging')
            }
        }

        stage('Smoke Test Staging') {
            steps {
                smokeTest('http://host.docker.internal:8081')
            }
        }

        stage('Approval') {
            when { expression { params.DEPLOY_TO_PRODUCTION } }
            steps {
                timeout(time: 15, unit: 'MINUTES') {
                    input message: "Staging is healthy. Deploy build #${env.BUILD_NUMBER} to production?", ok: 'Deploy'
                }
            }
        }

        stage('Deploy to Production') {
            when { expression { params.DEPLOY_TO_PRODUCTION } }
            steps {
                deploy('production')
            }
        }

        stage('Smoke Test Production') {
            when { expression { params.DEPLOY_TO_PRODUCTION } }
            steps {
                smokeTest('http://host.docker.internal:8082')
            }
        }
    }

    post {
        success {
            echo "Build #${env.BUILD_NUMBER} (${env.GIT_SHORT}) deployed successfully."
            archiveArtifacts artifacts: 'terraform/*-plan.txt, test-results.xml', allowEmptyArchive: true
        }
        failure {
            echo "Build #${env.BUILD_NUMBER} failed. Check the stage logs above."
        }
        always {
            sh 'docker image rm ${APP_NAME}-test:${IMAGE_TAG} > /dev/null 2>&1 || true'
        }
    }
}

// Plans and applies one environment with Terraform.
def deploy(String envName) {
    dir('terraform') {
        sh "terraform workspace select -or-create ${envName}"
        sh """
            terraform plan -no-color -out=${envName}.tfplan \
              -var-file=environments/${envName}.tfvars \
              -var image_tag=${env.IMAGE_TAG} \
              -var app_version=${env.APP_VERSION} \
              -var build_number=${env.BUILD_NUMBER} \
              -var git_commit=${env.GIT_SHORT}
        """
        sh "terraform show -no-color ${envName}.tfplan > ${envName}-plan.txt"
        sh "terraform apply -no-color ${envName}.tfplan"
        sh 'terraform output'
    }
}

// Checks that the deployed environment serves this build, through the load balancer.
def smokeTest(String url) {
    sh """
        for i in \$(seq 1 30); do curl -fs ${url}/api/health > /dev/null && break; sleep 2; done
        echo "--- ${url}/api/info"
        curl -fsS ${url}/api/info | tee smoke.json; echo
        grep -q '"build":"${env.BUILD_NUMBER}"' smoke.json
        echo "--- requests through the load balancer"
        for i in 1 2 3 4 5 6; do curl -fsS ${url}/api/health; echo; done
        test "\$(curl -s -o /dev/null -w '%{http_code}' ${url}/)" = "200"
        echo "Smoke test passed for ${url}"
    """
}
