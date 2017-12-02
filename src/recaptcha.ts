import * as fs from "fs";
import * as http from "http";
import * as mst from "mustache";
import * as rp from "request-promise";
import winston = require("winston");
import { Config } from "./config";

import { getAssetFolderPath } from "./asset";

import { ERROR502_URL_PATH, THANKS_URL_PATH } from "./handler";

interface RecaptchaResponse {
    success: boolean;
    challenge_ts: Date;
    hostname: string;
    errorCodes: string[];
}

export class RecaptchaFailure extends Error { }

async function checkIfSpam(
    remoteip: string,
    response: string,
    secret: string,
): Promise<boolean> {
    const options = {
        form: {
            remoteip,
            response,
            secret,
        },
        json: true,
        method: "POST",
        uri: "https://google.com/recaptcha/api/siteverify",
    };
    // tslint:disable-next-line:await-promise
    const body = (await rp(options)) as RecaptchaResponse;
    return !body.success;
}

export async function processReCaptcha(
    config: Config,
    parsedRequestData: { [k: string]: string },
    senderIpAddress: string,
    res: http.ServerResponse,
    pathName: string,
): Promise<boolean> {
    if (!config.disableRecaptcha && config.reCaptchaSecret) {
        if (parsedRequestData["g-recaptcha-response"]) {
            winston.debug(`g-recaptcha-response is present.`);
            const isSpam = await checkIfSpam(
                senderIpAddress,
                parsedRequestData["g-recaptcha-response"],
                config.reCaptchaSecret,
            );

            if (isSpam) {
                throw new RecaptchaFailure(`reCAPTCHA failure.`);
            }
        } else {
            if (!config.reCaptchaSiteKey) {
                throw new RecaptchaFailure(
                    `reCaptcha is enabled but g-recaptcha-response is not provided in request`);
            }
            renderAutomaticRecaptchaPage(
                config.reCaptchaSiteKey, parsedRequestData, res, pathName, config.assetsFolder);
            return false;
        }
    }
    return true;
}

function renderAutomaticRecaptchaPage(
    siteKey: string,
    postedData: { [k: string]: string },
    res: http.ServerResponse,
    pathName: string,
    assetFolder: string,
): void {
    const htmlTemplate =
        fs.readFileSync(getAssetFolderPath(assetFolder, "recaptcha.html")).toString();

    const templateData = {
        dataSiteKey: siteKey,
        errorPageUrl: ERROR502_URL_PATH,
        parsedRequestData: JSON.stringify(postedData),
        submitUrl: pathName,
        thanksPageUrl: postedData._redirect || THANKS_URL_PATH,
    };
    winston.debug(`Rendering Automatic reCaptcha page.`);
    const renderedHtml = mst.render(htmlTemplate, templateData);
    res.write(renderedHtml);
    res.end();
}
