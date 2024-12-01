#!/usr/bin/env bash

AEM_JAR=$(find /aem/crx-quickstart/app/ -name "*quickstart*.jar")

exec java \
    -server \
    -Djava.awt.headless=true \
    -XX:+UseParallelGC \
    -Xmx${JVM_XMX} \
    -XX:MaxMetaspaceSize=${JVM_META} \
    -agentlib:jdwp=transport=dt_socket,address=*:30303,server=y,suspend=n \
    -XX:+JavaMonitorsInStackTrace \
    -Dcom.sun.management.jmxremote.port=8686 \
    -Dcom.sun.management.jmxremote.ssl=false \
    -Dcom.sun.management.jmxremote.authenticate=false \
    -Dnashorn.args=--no-deprecation-warning \
    -Dsling.run.modes=${AEM_RUNMODE} \
    \
    -jar ${AEM_JAR} \
    \
    start -c /aem/crx-quickstart -i launchpad \
    -Dsling.properties=conf/sling.properties \
    -a 0.0.0.0 -p 4000 \
    >> /aem/crx-quickstart/logs/stdout.log
