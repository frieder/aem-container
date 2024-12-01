# AEM Container Image

This container image is designed to run Adobe Experience Manager (AEM) Cloud SDK 
within a container. It offers a basic AEM instance with minimal configuration. 
The instance type (author or publish) is determined at runtime through an environment 
variable. Additionally, it is built as a multi-architecture image (amd64, arm64) 
to ensure compatibility across various operating systems and platforms.

> Note: All the commands demonstrated on this page use `Podman`. However, the same 
> commands can also be used with `Docker` if you prefer.

# How To Use

You must first log in to your container registry. In the examples below, we will 
demonstrate using the GitHub Container Registry.

```shell
export TOKEN=***
export USER=<your github username here>
export REGISTRY=ghcr.io

echo ${TOKEN} | podman login ${REGISTRY} -u ${USER} --password-stdin
```

Next, you can pull the images from your container registry. We differentiate between 
a `stable` version, which represents the production installation, and the `latest`
version, which aligns with the Cloud Manager development environment (and potentially 
RDE). This approach allows you to test your code with the upcoming SDK version before 
upgrading your production environment.

```shell
podman pull ${REGISTRY}/${USER}/aem:stable
podman pull ${REGISTRY}/${USER}/aem:2024.10

podman pull ${REGISTRY}/${USER}/aem:latest
podman pull ${REGISTRY}/${USER}/aem:2024.11
```

Once you have successfully pulled the container image from the registry, you can proceed 
to start the containers. Be sure to adjust the arguments to suit your specific requirements.

```shell
podman run -d \
  --name author \
  -e TZ="Europe/Zurich" \
  -e JVM_XMX="4g" \
  -e JVM_META="512m" \
  -e AEM_RUNMODE="author,aemdev" \
  -p 4502:4000 \
  -p 14502:30303 \
  -p 24502:8686 \
  -v $(pwd)/volume/repo:/aem/crx-quickstart/repository \
  -v $(pwd)/volume/logs:/aem/crx-quickstart/logs \
  -v $(pwd)/volume/install:/aem/crx-quickstart/install \
  ${REGISTRY}/${USER}/aem:latest
```

> Note: When running the container in Podman, make sure the Podman VM was
> initialized with enough resources. By default it only acquires `2GB`, which is 
> not enough to run AEM.
> ```bash
> podman mmachine init --memory 16384
> ```

| Port  | Description |
|-------|-------------|
| 4000  | HTTP port   |
| 30303 | Debug port  |
| 8686  | JMX port    |

After the containers are created, you can use the following commands to start or stop them.

```shell
podman start author
podman stop author -t 180
```

When stopping the AEM container, ensure that the wait time is set to an appropriate 
value (e.g., `180` seconds). By default, Podman/Docker only waits `10` seconds for a 
container to stop before forcibly killing it. This abrupt termination can cause issues 
with the container, so it’s important to avoid this by allowing sufficient time for the 
container to shut down gracefully.

# How To Build

Before building the image, ensure that the SDK quickstart JAR file is located at 
`./tmp/aem-sdk-quickstart.jar` and the license file is available at 
`./tmp/license.properties`. These files will be picked up by the Dockerfile and included 
in the image. Once these prerequisites are met, you can build the image using the 
following command.

```shell
TEMURIN_VERSION=11.0.25_9-jre

podman build \
  --platform linux/amd64,linux/arm64 \
  --build-arg PKG="curl wget" \
  --build-arg LOCALE="en_GB.UTF-8" \
  --build-arg TEMURIN_VERSION="${TEMURIN_VERSION}" \
  --manifest ${REGISTRY}/${USER}/aem:2024.11 \
  .
```

All build arguments are optional. The table below provides a quick overview of the 
available options:

| Argument        | Description                                                                                          | Default |
|-----------------|------------------------------------------------------------------------------------------------------|---------|
| PKG             | A space-separated list of OS packages to install                                                     |         |
| LOCALE          | Set the system locate.                                                                               | en_GB.UTF-8 |
| TEMURIN_VERSION | The [Temurin container image](https://hub.docker.com/_/eclipse-temurin) to run AEM on. | 11.0.25_9-jre |

Some arguments in [scripts/start.sh](scripts/start.sh) are hard-coded and applied to both 
the JVM and AEM, and they cannot be modified directly. If these settings don't suit your 
needs, you can either customize the bash script to your preferences or make the arguments 
configurable as build parameters.

> The command above creates a multi-architecture image supporting both `amd64` and `arm64`
> architectures. If you are building a similar image using Docker, consider using 
> [Docker Buildx](https://docs.docker.com/engine/reference/commandline/buildx/)
> for multi-architecture support.

The last action is to push the container image to your container registry.

```shell
podman manifest push ${REGISTRY}/${USER}/aem:2024.11
podman manifest push ${REGISTRY}/${USER}/aem:2024.11 ${REGISTRY}/${USER}/aem:latest
```

## Build Pipeline Example

The pipeline scripts at [.github/workflows/podman.yml](.github/workflows/podman.yml)
and [.github/workflows/docker.yml](.github/workflows/docker.yml)
show a GH build pipeline that pulls data from a remote artifact repository (Nexus OSS) 
and prepares them for the use in the build pipeline. The following JSON snippet 
illustrates the structure of version.json. This file is downloaded first and is used 
to determine the paths of the files to be retrieved:
 
```json
{
  "license": "/aem/lic/license.properties",
  "stable": {
    "jdk": "11.0.25_9-jre",
    "sdk": "/aem/sdk/bin/aem-sdk-2024.10.18459.20241031T210302Z-241000.zip",
    "pkg": [
      "/aem/sdk/packages/universal-editor-service-vprod-20241118150153.zip"
    ]
  },
  "latest": {
    "jdk": "11.0.25_9-jre",
    "sdk": "/aem/sdk/bin/aem-sdk-2024.11.18598.20241113T125352Z-241100.zip",
    "pkg": [
      "/aem/sdk/packages/aem-guides-wknd.all-3.2.0.zip",
      "/aem/sdk/packages/aem-guides-wknd.ui.content.sample-3.2.0.zip",
      "/aem/sdk/packages/universal-editor-service-vprod-20241118150153.zip"
    ]
  }
}
```

