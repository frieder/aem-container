const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const core = require("@actions/core");
const axios = require("axios");
const axiosRetry = require("axios-retry").default;

(async function () {
    const args = getGithubInputs();
    const httpc = createHttpClient(args);
    const json = (await httpc.get("/aem/versions.json")).data;
    await downloadLicense(httpc, json);
    await downloadSDK(httpc, args, json);
    await downloadPackages(httpc, args, json);
    registerOutputs(args, json);
})().catch((err) => {
    core.setFailed("An unexpected error has occurred");
    core.error(err);
    core.error(JSON.stringify(err));
});

function getGithubInputs() {
    const req = { required: true };
    const opt = { required: false };

    const version = core.getInput("version", req);
    const username = core.getInput("username", opt);
    const password = core.getInput("password", opt);
    const token = core.getInput("token", opt);
    const url = core.getInput("url", req);

    if (!token && !username && !password) {
        throw new Error("Invalid arguments. Either 'token' or 'username' & 'password' are required");
    }

    return {
        version,
        username,
        password,
        token,
        url,
    };
}

function createHttpClient(args) {
    const config = {
        baseURL: args.url,
        timeout: 10000,
    };

    if (args.token) {
        config.headers.Authorization = `Bearer ${args.token}`;
    } else {
        config.auth = {
            username: args.username,
            password: args.password,
        };
    }

    const httpc = axios.create(config);

    const retryCondition = (error) => {
        return (
            axiosRetry.isNetworkOrIdempotentRequestError(error) ||
            (error.response && ![200].includes(error.response.status))
        );
    };

    axiosRetry(httpc, {
        retries: 2,
        retryCondition: retryCondition,
        retryDelay: () => 10000,
        shouldResetTimeout: true,
        onRetry: (retryCount, error) => {
            core.info(`Request failed with [${error.response?.status}], try again in 10s`);
        },
    });

    return httpc;
}

async function downloadLicense(httpc, json) {
    await _downloadFile(httpc, json.license, "./tmp/license.properties");
    core.info("Downloaded license.properties");
}

async function downloadSDK(httpc, args, json) {
    await _downloadFile(httpc, json[args.version].sdk, "./tmp/aem-sdk.zip");
    core.info("Downloaded aem-sdk.zip");
}

async function downloadPackages(httpc, args, json) {
    const packages = json[args.version].pkg;

    for (const pkg of packages) {
        const filename = path.basename(pkg);
        await _downloadFile(httpc, pkg, `./install/${filename}`);
        core.info(`Downloaded ${filename}`);
    }
}

async function _downloadFile(httpc, source, target) {
    const filePath = path.resolve(target);
    const writer = fs.createWriteStream(filePath);

    const response = await httpc({
        method: "GET",
        url: source,
        responseType: "stream",
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
}

function registerOutputs(args, json) {
    const base = json[args.version];

    core.setOutput("jdk", base.jdk);
    core.setOutput("version", _getVersion(base.sdk));

    core.setOutput("date", new Date().toISOString().slice(0, 10));
    core.setOutput("rev", execSync("git rev-parse --short HEAD").toString().trim());
}

function _getVersion(path) {
    const match = path.match(/aem-sdk-(\d{4}\.\d{1,2})/);

    if (match) {
        return match[1];
    }

    throw new Error(`Unsupported version in "${path}"`);
}
