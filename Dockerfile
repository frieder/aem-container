ARG TEMURIN_VERSION=11.0.25_9-jre

########################################################################################################################

FROM eclipse-temurin:${TEMURIN_VERSION} AS builder

WORKDIR /tmp/aem

COPY tmp/*.jar ./aem-quickstart.jar

RUN java -jar ./aem-quickstart.jar -unpack && \
    mkdir crx-quickstart/install && \
    rm aem-quickstart.jar && \
    rm crx-quickstart/bin/*.bat && \
    rm crx-quickstart/readme.txt && \
    rm crx-quickstart/eula-*.html

COPY tmp/license.properties ./license.properties
COPY install/* ./crx-quickstart/install/
COPY scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

########################################################################################################################

FROM eclipse-temurin:${TEMURIN_VERSION}

ARG PKG
ARG LOCALE="en_GB.UTF-8"
ARG JVM_XMX="4g"
ARG JVM_META="512m"
ARG AEM_RUNMODE="author"

ENV LC_ALL="${LOCALE}" \
    LANG="${LOCALE}" \
    LANGUAGE="${LOCALE}" \
    JVM_XMX="${JVM_XMX}" \
    JVM_META="${JVM_META}" \
    AEM_RUNMODE="${AEM_RUNMODE}"

WORKDIR /aem

COPY --from=builder /tmp/aem ./

EXPOSE 4500 30303 8686

VOLUME ["/aem/crx-quickstart/repository", "/aem/crx-quickstart/logs", "/aem/crx-quickstart/install"]

RUN apt update && \
    DEBIAN_FRONTEND=noninteractive apt full-upgrade -y --no-install-recommends && \
    DEBIAN_FRONTEND=noninteractive apt install -y tini --no-install-recommends && \
    \
    if [ ! "x$PKG" = "x" ]; then \
        DEBIAN_FRONTEND=noninteractive apt install -y ${PKG} --no-install-recommends ; \
    fi && \
    DEBIAN_FRONTEND=noninteractive apt autoremove -y && \
    \
    locale-gen ${LOCALE} && \
    \
    rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/usr/bin/tini", "--", "/aem/start.sh"]
