"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const mst = require("mustache");
const winston = require("winston");
const captcha_1 = require("./captcha");
const database_1 = require("./database");
const helpers_1 = require("./form-target/helpers");
const handler_1 = require("./handler");
const header_1 = require("./header");
const message_1 = require("./message");
const request_1 = require("./request");
const send_1 = require("./send");
const PLAIN_TEXT_EMAIL_TEMPLATE_PATH = "./assets/plain-text-email-template.mst";
const HTML_EMAIL_TEMPLATE_PATH = "./assets/html-email-template.html";
class NotFoundError extends Error {
}
exports.NotFoundError = NotFoundError;
function formHandler(config, pathname, req, res) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const [postedData, bodyStr] = yield request_1.parseRequestData(req, config.maxHttpRequestSize);
        winston.debug(`Request body: ${JSON.stringify(postedData)}`);
        // gathering information
        const senderIpAddress = req.connection.remoteAddress || "unknown remote address";
        const refererUrl = getRefererUrl(postedData, req);
        const formName = postedData._formname ? `Submitted form: ${postedData._formname}\n` : "";
        yield captcha_1.checkCaptcha(postedData["g-recaptcha-response"], config.disableRecaptcha, senderIpAddress, config.reCaptchaSecret);
        // rendering email contents
        const mustacheTemplateData = message_1.constructFieldsArrayForMustache(postedData);
        const plainTextEmailTemplate = fs.readFileSync(PLAIN_TEXT_EMAIL_TEMPLATE_PATH).toString();
        const htmlEmailTemplate = fs.readFileSync(HTML_EMAIL_TEMPLATE_PATH).toString();
        const templateData = {
            formName,
            mustacheTemplateData,
            refererUrl,
            senderIpAddress,
        };
        const plainTextEmailMessage = mst.render(plainTextEmailTemplate, templateData);
        const htmlEmailMessage = mst.render(htmlEmailTemplate, templateData);
        // getting email subject and recepients
        const subject = helpers_1.getSubject(config, formTargetKey);
        const recepients = helpers_1.getRecipients(config, formTargetKey);
        const renderedSubject = mst.render(subject, { refererUrl, formName });
        // sending and saving email
        yield send_1.sendEmail(config, recepients, renderedSubject, plainTextEmailMessage, htmlEmailMessage);
        yield database_1.saveEmailToDB(config.databaseFileName, senderIpAddress, bodyStr, refererUrl, formName, recepients, plainTextEmailMessage);
        // preparing response
        const isAjax = request_1.isAjaxRequest(req);
        if (isAjax) {
            header_1.setCorsHeaders(res);
            res.setHeader("content-type", "application/json");
            res.write(JSON.stringify({ result: "ok" }));
        }
        else {
            const redirectUrl = postedData._redirect || handler_1.THANKS_URL_PATH;
            winston.debug(`Redirecting to ${redirectUrl}`);
            res.writeHead(303, { Location: redirectUrl });
        }
        res.end();
    });
}
exports.formHandler = formHandler;
function getRefererUrl(post, req) {
    const headerRefererUrl = (req.headers.referer instanceof Array) ?
        req.headers.referer[0] : req.headers.referer;
    return post._formurl || headerRefererUrl || "Unspecified URL";
}
