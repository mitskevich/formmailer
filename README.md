# FormMailer

![CircleCI badge](https://img.shields.io/circleci/project/github/Taisiias/formmailer.svg)

**FormMailer is a simple way to receive emails from contact forms on your static website.**

It runs as a service and emails contents of the forms posted to it.

![Workflow](/img/formmailer-workflow.png)

Suppose you have this static page:

```html
<html>
<body>
    <form action="http://myformmailer.mydomain.com/submit" method="post">
        <div>
            <label for="msg">Message:</label>
            <textarea id="msg" name="User Message"></textarea>
        </div>
        <div class="button">
            <button type="submit">Send your message</button>
        </div>
    </form>
</body>
</html>
```

FormMailer service deployed on your domain `http://myformmailer.mydomain.com/` will receive user-submitted POST requests and send emails similar to this one:

```
> Content-Type: text/plain
> From: formmailer@mydomain.com
> To: support@mydomain.com
> Subject: Form submitted on http://mydomain.com/index.html
> Message-ID:
>  <dfc9cdf6-ec60-1a6a-089c-bed4566b05ef@mydomain.com>
> Content-Transfer-Encoding: 7bit
> Date: Mon, 14 Aug 2017 13:29:25 +0000
> MIME-Version: 1.0
>
> Submitted user form was received by FormMailer server, see details below.
>
> Referrer page: http://mydomain.com/index.html
>
> User Message:
>   Hello world!
>
> Submitter IP address: 1.2.3.4
```

FormMailer also:

* supports HTTPS.
* supports plain text and HTML emails.
* uses [Mustache.JS](https://github.com/janl/mustache.js) templates for email body and subject.
* saves all received data (and sent emails) to the local SQLite database.
* understands reCAPTCHA.
* supports `application/json` and `application/x-www-form-urlencoded` content types.

## Running

1. Install [Node.js](https://nodejs.org/en/) (version 6.11 or higher).

2. Install FormMailer with the command:

    ```bash
    npm install -g formmailer
    ```

3. Create a new `config.json` file and place following defaults inside:

    ```json
    {
        "recipientEmails" : "root@localhost",
        "fromEmail": "formmailer@localhost",
        "httpListenIP": "0.0.0.0",
        "httpListenPort": 3000
    }
    ```

     Edit settings specific for your environment (see [Configuration options](#configuration-options)). At least specify `recipientEmails` and `fromEmail`.

4. Start FormMailer:

    ```bash
    formmailer
    ```

    You can specify `config.json` file location with `-c` command line argument: `formmailer -c /path/to/my/config.json`.

Now, change the action field in your HTML form(s) to something like this:
```html
<form method="post" action="http://[domain or ip]:[port]/submit"> ...
```

Here `[domain or ip]` should be your FormMailer server domain (or IP address), and `[port]` should be the port which your FormMailer instance listens to (`httpListenPort` config setting).

## Configuration options

Default configuration file location is `./config.json`. You can provide different location with `-c` command line argument.

Option  | Description | Default
--------|-------------|--------
`assetsFolder` | Path to the folder containing static assets. | `"./assets"`
`databaseFileName` | Path to the SQLite database file. | `"./formmailer.db"`
`disableRecaptcha` | If true, receiver handler should not check `g-recaptcha-response` field even if site key is provided. | `false`
`enableHtmlEmail` | Enables sending out HTML versions of emails. | `true`
`enableHttp` | Determines if HTTP should be enabled | true
`enableHttps` | Determines if HTTPS should be enabled | true
`formTargets` | See details in [Sending different forms to different recipients](#sending-different-forms-to-different-recipients)| { }
`fromEmail` | E-mail address that will be provided in `From:` email header. | `"formmailer@localhost"`
`httpListenIP` | IP address to listen HTTP requests from. | `"0.0.0.0"` (all IP addresses)
`httpListenPort` | Port to listen HTTP requests from. | `3000`
`httpsListenIP` | IP address to listen HTTPS requests from. | `"0.0.0.0"` (all IP addresses)
`httpsListenPort` | Port to listen HTTPS requests from. | `443`
`httpsPrivateKeyPath` | Path to HTTPS private key. Specify to enable HTTPS. | ""
`httpsCertificatePath` | Path to HTTPS certificate. Specify to enable HTTPS. | ""
`logLevel` | How detailed logging should be (`error`, `warn`, `info`, `verbose`, `debug`, `silly`). | `"info"`
`maxHttpRequestSize` | Maximum allowed size of HTTP requests, in bytes. | `1000000`
`reCaptchaSecret` | Site secret reCAPTCHA key. No captcha checks will be performed if this value is not set. | `""`
`reCaptchaSiteKey` | Public reCaptcha site key. | `""`
`recipientEmails` | E-mail recipient address. String or array of strings (for multiple recepients). | Required field.
`redirectFieldName` | Name of the HTML input that contains redirect URL address. | `"_redirect"`
`smtpHost` | SMTP server host name or IP. | `"localhost"`
`smtpPort` | SMTP server port. | `25`
`smtpOptions` | [Nodemailer options](https://nodemailer.com/smtp/) object. | `{host: "localhost", port: 25, tls: { rejectUnauthorized: false }}`
`subject` | Email subject field content. Special entry `{{{referrerUrl}}}` will be changed to the address of the webpage from where the form is submitted. | `"Form submitted on {{{referrerUrl}}}"`

## Optional features

### Special fields

HTML fields with names that start with the underscore character are ignored by FormMailer:

```html
<input type="text" name="_thisIsIgnored" value="stuff that doesn't have to be sent in email">
```

Also, there are some special fields that can be provided in hidden inputs:

Input name | Meaning
-----------|--------
`_redirect` | URL where to redirect user after the form is successfuly submitted. If `_redirect` field is omitted, user will be redirected to the default `thanks.html` page hosted by FormMailer.
`_formurl` | Value will replace referrer in emails.
`_formname` | Value will show up in emails. Should help to identify which form was submitted if there are several on the page.

### reCAPTCHA

By default, Formmailer automatically checks reCAPTCHA if both `dataSiteKey` and `reCaptchaSecret` are present in config. reCAPTCHA check can be disabled by setting `disableRecaptcha` option to false.

#### Automatic reCAPTCHA

If `g-recaptcha-response` field is present in post, Formmailer will immediately start reCAPTCHA check. If not, `recaptcha.html` page will be rendered and will be submitted itself with post data recieved from your initial page along with `g-recaptcha-response` field.

#### Manual reCAPTCHA

To send `g-recaptcha-response` with your post you will need to set up reCAPTCHA checking on your website:

1. Sign up for reCAPTCHA (https://www.google.com/recaptcha/admin), get site key and secret key.

2. Write secret key value into `reCaptchaSecret` option in your config file.

3. Set up reCAPTCHA integration on your static site HTML form.

    Refer to the link below on how to setup reCAPTCHA on the client side.

    https://developers.google.com/recaptcha/docs/display

### Sending different forms to different recipients

First, add a dictionary similar to the one below to the configuration file:

```json
"formTargets": {
    "contact": "contact@mydomain.com",
    "support": ["support@mydomain.com", "team@mydomain.com"],
    "sales": {
        "recipient": "sales@mydomain.com",
        "subject": "Purchase inquiry submitted"
    }
}
```
After that, provide form's action URL in the following format

`http://formmailer.domain.com/submit/<formtarget>` where `<formtarget>` is a key from this dictionary.

```html
<form method="POST" action="http://formmailer.domain.com/submit/sales">...
```

FormMailer will use a corresponding recipient (and optionally a subject) instead of the default one.

### Enabling HTTPS

Acquire SSL certificate (either buy from one of the authorities or [get one for free](https://gethttpsforfree.com/)). You should have two files (usually `.pem` and `.crt`). Put them in some directory.

In the configuration file add private key (`.pem`) path into `httpsPrivateKeyPath` and certificate (`.crt`) path into `httpsCertificatePath`. For example:

```json
{
    ...
    "httpsPrivateKeyPath": "./mycert/mydomain.pem",
    "httpsCertificatePath": "./mycert/mydomain.crt"
}
```

On the next run FormMailer should start HTTPS server, along with HTTP. If you wish to disable HTTP, change `enableHttp` config setting to `false`.

### JSON Resquests

FormMailer accepts JSON requests, distingushing them by `content-type: application/json` HTTP header. FormMailer expects JSON to contain an object. Properties of this object along with their values will be listed in the email. Other behaviour is similar to requests with `content-type: application/x-www-form-urlencoded`, i. e. special fields with names starting with `_` will be ignored and `g-recaptcha-response` field will be used for reCAPTCHA authentication.

If email was sent successfully, JSON response `{ result: "ok" }` will be returned. Or `{ result: "error", description: "error details description" }`, in case of an error.

### Email templates

FormMailer is using [Mustache.JS](https://github.com/janl/mustache.js) templates for email body and subject. Email can be sent both as plain text and as HTML. Sending out HTML emails can be turned off by setting `enableHtmlEmail` to `false` in the config.

Path to plain text email template is `./assets/plain-text-email-template.mst`.

Path to HTML template is `./assets/html-email-template.html`.

Subject text template can be changed in the `subject` configuration setting.

All templates may include following variables:

Variable | Description
--------|-------------
`formName` | Name of the form (provided by `_formname` special form field).
`incomingIp` | Sender IP address.
`mustacheTemplateData` | User-submitted data (key: `key`, value: `textValue`).
`refererUrl` | Referer URL (from HTTP request headers).

## Deploying

**Example for Ubuntu 17.04**

Create a new file `/lib/systemd/system/formmailer.service` and place the following contents inside:

```ini
[Unit]
Description=FormMailer Service
After=network.target

[Service]
Type=simple
User=formmailer
Group=formmailer
ExecStart=/usr/bin/node ./dist/src/index.js -c ./config.json
Restart=on-failure
Environment=NODE_ENV=production
WorkingDirectory=/var/formmailer

[Install]
WantedBy=multi-user.target
```

Change `WorkingDirectory` to the directory where you have cloned FormMailer.

Supposing you have cloned the FormMailer repository to `/var/formmailer`, run:

```bash
$ # create user and group
$ sudo groupadd formmailer && sudo useradd formmailer -g formmailer

$ # go to the formmailer repo directory
$ cd /var/formmailer

$ # change the owner of the formmailer directory to the formmailer user
$ sudo chown formmailer:formmailer . -R

$ # force systemd to load the new service file
$ sudo systemctl daemon-reload

$ # start the service
$ sudo systemctl start formmailer
```

Don't forget to check your firewall settings to allow outside TCP connections to the port specified in `httpListenPort` setting.

*NOTE: FormMailer uses default NodeJS HTTP server. For production environment it is recommended to set up a reverse proxy (Nginx or alternative) that will hide the FormMailer service from the outside world.*

## Alternatives

* [Formspree](https://github.com/formspree/formspree)
* [FormMailerService](https://github.com/abbr/FormMailerService)

## License

[MIT License](LICENSE)
