import * as fs from "fs";
import * as http from "http";
import * as mst from "mustache";
import * as qs from "querystring";
import winston = require("winston");
import { checkCaptcha } from "./captcha";
import { Config } from "./config";
import { saveEmailToDB } from "./database";
import { getRecipients, getSubject } from "./form-target/helpers";
import { constructFieldsValuesStr } from "./message";
import { sendEmail } from "./send";
import { readReadable } from "./stream";

const EMAIL_TEMPLATE_PATH = "./assets/email-template.mst";
export const THANKS_URL_PATH = "/thanks";
export class NotFoundError extends Error { }

export async function formHandler(
    config: Config,
    pathname: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    isAjax: boolean,
): Promise<void> {

    // getting form target key if there is one
    let formTargetKey = "";
    winston.debug(`Provided URL path name: "${pathname}"`);
    formTargetKey = pathname.slice(pathname.lastIndexOf("/submit") + 8);
    if (formTargetKey.endsWith("/")) {
        formTargetKey = formTargetKey.slice(0, formTargetKey.lastIndexOf("/"));
    }
    winston.debug(`Provided form target key: "${formTargetKey}"`);
    if (formTargetKey) {
        if (!config.formTargets.hasOwnProperty(formTargetKey)) {
            throw new NotFoundError(`Target form "${formTargetKey}" doesn't exist in config.`);
        }
    }

    // getting posted data from the request
    const bodyStr = await readReadable(req, config.maxHttpRequestSize);
    const postedData: { [k: string]: string } = isAjax ? JSON.parse(bodyStr) : qs.parse(bodyStr);
    winston.debug(`Request body: ${JSON.stringify(postedData)}`);

    // gathering information
    const incomingIp = req.connection.remoteAddress || "unknown remote address";
    const refererUrl = getRefererUrl(postedData, req);
    const formName = postedData._formname ? `Submitted form: ${postedData._formname}\n` : "";

    await checkCaptcha(
        postedData["g-recaptcha-response"],
        config.requireReCaptchaResponse,
        incomingIp,
        config.reCaptchaSecret);

    // rendering email contents
    const fieldsValuesStr = await constructFieldsValuesStr(postedData);
    winston.debug(`Fields: ${fieldsValuesStr}`);
    const template = fs.readFileSync(EMAIL_TEMPLATE_PATH).toString();
    const templateData = {
        fieldsValuesStr,
        formName,
        incomingIp,
        refererUrl,
    };
    const emailMessage = mst.render(template, templateData);

    // getting email subject and recepients
    const subject = getSubject(config, formTargetKey);
    const recepients = getRecipients(config, formTargetKey);

    const renderedSubject = mst.render(subject, { refererUrl, formName });

    // sending and saving email
    await sendEmail(config, recepients, renderedSubject, emailMessage);
    saveEmailToDB(config.databaseFileName, incomingIp, bodyStr, refererUrl, formName,
                  recepients, emailMessage);

    // preparing response
    if (isAjax) {
        res.setHeader("content-type", "application/json");
        res.write(JSON.stringify({ result: "OK" }));
    } else {
        const redirectUrl = postedData._redirect || THANKS_URL_PATH;
        winston.debug(`Redirecting to ${redirectUrl}`);
        res.writeHead(303, { Location: redirectUrl });
    }
    res.end();
}

function getRefererUrl(
    post: { [k: string]: string },
    req: http.IncomingMessage,
): string {
    const headerRefererUrl: string =
        (req.headers.referer instanceof Array) ?
            req.headers.referer[0] : req.headers.referer as string;

    return post._formurl || headerRefererUrl || "Unspecified URL";
}