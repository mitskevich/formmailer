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
const rp = require("request-promise");
const winston = require("winston");
const handler_1 = require("./handler");
class RecaptchaFailure extends Error {
}
exports.RecaptchaFailure = RecaptchaFailure;
function checkIfSpam(remoteip, response, secret) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const body = (yield rp(options));
        return !body.success;
    });
}
function processReCaptcha(config, parsedRequestData, senderIpAddress, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!config.disableRecaptcha && config.reCaptchaSecret) {
            if (parsedRequestData["g-recaptcha-response"]) {
                const isSpam = yield checkIfSpam(senderIpAddress, parsedRequestData["g-recaptcha-response"], config.reCaptchaSecret);
                if (isSpam) {
                    throw new RecaptchaFailure(`reCAPTCHA failure.`);
                }
            }
            else {
                if (!config.reCaptchaSiteKey) {
                    throw new RecaptchaFailure(`reCaptcha is enabled but g-recaptcha-response is not provided in request`);
                }
                renderAutomaticRecaptchaPage(config, parsedRequestData, res);
                return false;
            }
        }
        return true;
    });
}
exports.processReCaptcha = processReCaptcha;
function renderAutomaticRecaptchaPage(config, postedData, res) {
    const htmlTemplate = fs.readFileSync("./assets/recaptcha.html").toString();
    const templateData = {
        dataSiteKey: config.reCaptchaSiteKey,
        parsedRequestData: JSON.stringify(postedData),
        submitUrl: handler_1.SUBMIT_URL_PATH,
        thanksPageUrl: postedData._redirect || handler_1.THANKS_URL_PATH,
    };
    winston.debug(`Rendering Automatic reCaptcha page.`);
    const renderedHtml = mst.render(htmlTemplate, templateData);
    res.write(renderedHtml);
    res.end();
}