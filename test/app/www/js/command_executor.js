'use strict';

/* 
 * A note on scheduling:
 *
 * Callbacks sent from Java -> Javascript through PluginResult are by nature not ordered.
 *  scheduleCommand(command) tries to receive commands and schedule them in an array (this.savedCommand)
 *  that would be executed based on what `this.nextToSendCounter` specifies.
 * 
 * Sorting mechanism goes as follows
 * - When receiving a new command...
 *   * if the new command is in order, send it immediately.
 *   * If the new command is not in order
 *     * Store it in a list
 *     * Check the list if it contains the next command to send
 * - After sending a command...
 *     * Check the list if it contains the next command to send
 * 
 * So this system is rechecking the list for items to send on two events:
 * - When a new not-in-order object is added.
 * - After a successful send
 */

// A wrapper for a command received from test server.
function AdjustCommand(functionName, params, order) {
    this.functionName = functionName;
    this.params = params;
    this.order = order;
}

function CommandExecutor(baseUrl, gdprUrl) {
    this.adjustCommandExecutor = new AdjustCommandExecutor(baseUrl, gdprUrl);
};

CommandExecutor.prototype.scheduleCommand = function(className, functionName, params, order) {
    switch (className) {
        case "Adjust":
            var command = new AdjustCommand(functionName, params, order);
            this.adjustCommandExecutor.scheduleCommand(command);
            break;
    }
};

function AdjustCommandExecutor(baseUrl, gdprUrl) {
    this.baseUrl = baseUrl;
    this.gdprUrl = gdprUrl;
    this.basePath = null;
    this.gdprPath = null;
    this.savedEvents = {};
    this.savedConfigs = {};
    this.savedCommands = [];
    this.nextToSendCounter = 0;
};

// First point of entry for scheduling commands. Takes a 'AdjustCommand {command}' parameter.
AdjustCommandExecutor.prototype.scheduleCommand = function(command) {
    // If the command is in order, send in immediately.
    if (command.order === this.nextToSendCounter) {
        this.executeCommand(command, -1);
        return;
    }

    // Not in order, schedule it.
    this.savedCommands.push(command);

    // Recheck list.
    this.checkList();
}

// Check the list of commands to see which one is in order.
AdjustCommandExecutor.prototype.checkList = function() {
    for (var i = 0; i < this.savedCommands.length; i++ ) {
        var command = this.savedCommands[i];
        if (command.order === this.nextToSendCounter) {
            this.executeCommand(command, i);
            return;
        }
    }
}

// Execute the command. This will always be invoked either from:
//  - checkList() after scheduling a command
//  - scheduleCommand() only if the package was in order
//
// (AdjustCommand {command}) : The command to be executed
// (Number {idx})            : index of the command in the schedule list. -1 if it was sent directly
AdjustCommandExecutor.prototype.executeCommand = function(command, idx) {
    console.log(`[*] executeCommand(): ${JSON.stringify(command)}`);
    switch (command.functionName) {
        case "testOptions" : this.testOptions(command.params); break;
        case "config" : this.config(command.params); break;
        case "start" : this.start(command.params); break;
        case "event" : this.event(command.params); break;
        case "trackEvent" : this.trackEvent(command.params); break;
        case "resume" : this.resume(command.params); break;
        case "pause" : this.pause(command.params); break;
        case "setEnabled" : this.setEnabled(command.params); break;
        case "setReferrer" : this.setReferrer(command.params); break;
        case "setOfflineMode" : this.setOfflineMode(command.params); break;
        case "sendFirstPackages" : this.sendFirstPackages(command.params); break;
        case "addSessionCallbackParameter" : this.addSessionCallbackParameter(command.params); break;
        case "addSessionPartnerParameter" : this.addSessionPartnerParameter(command.params); break;
        case "removeSessionCallbackParameter" : this.removeSessionCallbackParameter(command.params); break;
        case "removeSessionPartnerParameter" : this.removeSessionPartnerParameter(command.params); break;
        case "resetSessionCallbackParameters" : this.resetSessionCallbackParameters(command.params); break;
        case "resetSessionPartnerParameters" : this.resetSessionPartnerParameters(command.params); break;
        case "setPushToken" : this.setPushToken(command.params); break;
        case "openDeeplink" : this.openDeeplink(command.params); break;
        case "sendReferrer" : this.sendReferrer(command.params); break;
        case "gdprForgetMe" : this.gdprForgetMe(command.params); break;
        case "trackAdRevenue" : this.trackAdRevenue(command.params); break;
    }

    this.nextToSendCounter++;

    // If idx != -1, it means it was not sent directly. Delete its instance from the scheduling array.
    if (idx != -1) {
        this.savedCommands.splice(idx, 1);
    }

    // Recheck the list.
    this.checkList();
};

AdjustCommandExecutor.prototype.testOptions = function(params) {
    var testOptions = new AdjustTestOptions();
    testOptions.baseUrl = this.baseUrl;
    testOptions.gdprUrl = this.gdprUrl;
    if ('basePath' in params) {
        this.basePath = getFirstParameterValue(params, 'basePath');
        this.gdprPath = getFirstParameterValue(params, 'basePath');
    }
    if ('timerInterval' in params) {
        testOptions.timerIntervalInMilliseconds = getFirstParameterValue(params, 'timerInterval').toString();
    }
    if ('timerStart' in params) {
        testOptions.timerStartInMilliseconds = getFirstParameterValue(params, 'timerStart').toString();
    }
    if ('sessionInterval' in params) {
        testOptions.sessionIntervalInMilliseconds = getFirstParameterValue(params, 'sessionInterval').toString();
    }
    if ('subsessionInterval' in params) {
        testOptions.subsessionIntervalInMilliseconds = getFirstParameterValue(params, 'subsessionInterval').toString();
    }
    if ('noBackoffWait' in params) {
        var noBackoffWait = getFirstParameterValue(params, 'noBackoffWait');
        testOptions.noBackoffWait = noBackoffWait == 'true';
    }
    if ('iAdFrameworkEnabled' in params) {
        var iAdFrameworkEnabled = getFirstParameterValue(params, 'iAdFrameworkEnabled');
        testOptions.iAdFrameworkEnabled = iAdFrameworkEnabled == 'true';
    }
    if ('teardown' in params) {
        var teardownOptions = getValueFromKey(params, 'teardown');
        for (var i = 0; i < teardownOptions.length; i++) {
            var option = teardownOptions[i];
            if ('resetSdk' === option) {
                testOptions.teardown = true;
                testOptions.basePath = this.basePath;
                testOptions.gdprPath = this.gdprPath;
                testOptions.useTestConnectionOptions = true;
                Adjust.teardown('test');
            }
            if ('deleteState' === option) {
                testOptions.hasContext = true;
            }
            if ('resetTest' === option) {
                this.savedEvents = {};
                this.savedConfigs = {};
                testOptions.timerIntervalInMilliseconds = (-1).toString();
                testOptions.timerStartInMilliseconds = (-1).toString();
                testOptions.sessionIntervalInMilliseconds = (-1).toString();
                testOptions.subsessionIntervalInMilliseconds = (-1).toString();
            }
            if ('sdk' === option) {
                testOptions.teardown = true;
                testOptions.basePath = null;
                testOptions.gdprPath = null;
                testOptions.useTestConnectionOptions = false;
                Adjust.teardown('test');
            }
            if ('test' === option) {
                this.savedEvents = null;
                this.savedConfigs = null;
                testOptions.timerIntervalInMilliseconds = (-1).toString();
                testOptions.timerStartInMilliseconds = (-1).toString();
                testOptions.sessionIntervalInMilliseconds = (-1).toString();
                testOptions.subsessionIntervalInMilliseconds = (-1).toString();
            }
        }
    }

    Adjust.setTestOptions(testOptions);
};

AdjustCommandExecutor.prototype.config = function(params) {
    var configNumber = 0;
    if ('configName' in params) {
        var configName = getFirstParameterValue(params, 'configName');
        configNumber = parseInt(configName.substr(configName.length - 1))
    }

    var adjustConfig;
    if (configNumber in this.savedConfigs) {
        adjustConfig = this.savedConfigs[configNumber];
    } else {
        var environment = getFirstParameterValue(params, "environment");
        var appToken = getFirstParameterValue(params, "appToken");
        adjustConfig = new AdjustConfig(appToken, environment);
        adjustConfig.setLogLevel(AdjustConfig.LogLevelVerbose);
        this.savedConfigs[configNumber] = adjustConfig;
    }

    if ('logLevel' in params) {
        var logLevelS = getFirstParameterValue(params, 'logLevel');
        var logLevel = null;
        switch (logLevelS) {
            case "verbose":
                logLevel = AdjustConfig.LogLevelVerbose;
                break;
            case "debug":
                logLevel = AdjustConfig.LogLevelDebug;
                break;
            case "info":
                logLevel = AdjustConfig.LogLevelInfo;
                break;
            case "warn":
                logLevel = AdjustConfig.LogLevelWarn;
                break;
            case "error":
                logLevel = AdjustConfig.LogLevelError;
                break;
            case "assert":
                logLevel = AdjustConfig.LogLevelAssert;
                break;
            case "suppress":
                logLevel = AdjustConfig.LogLevelSuppress;
                break;
        }

        adjustConfig.setLogLevel(logLevel);
    }

    if ('sdkPrefix' in params) {
        var sdkPrefix = getFirstParameterValue(params, 'sdkPrefix');
        adjustConfig.setSdkPrefix(sdkPrefix);
    }

    if ('defaultTracker' in params) {
        var defaultTracker = getFirstParameterValue(params, 'defaultTracker');
        adjustConfig.setDefaultTracker(defaultTracker);
    }

    if ('appSecret' in params) {
        var appSecretArray = getValueFromKey(params, 'appSecret');
        var secretId = appSecretArray[0].toString();
        var info1    = appSecretArray[1].toString();
        var info2    = appSecretArray[2].toString();
        var info3    = appSecretArray[3].toString();
        var info4    = appSecretArray[4].toString();
        adjustConfig.setAppSecret(secretId, info1, info2, info3, info4);
    }

    if ('delayStart' in params) {
        var delayStartS = getFirstParameterValue(params, 'delayStart');
        var delayStart = parseFloat(delayStartS);
        adjustConfig.setDelayStart(delayStart);
    }

    if ('deviceKnown' in params) {
        var deviceKnownS = getFirstParameterValue(params, 'deviceKnown');
        var deviceKnown = deviceKnownS == 'true';
        adjustConfig.setDeviceKnown(deviceKnown);
    }

    if ('eventBufferingEnabled' in params) {
        var eventBufferingEnabledS = getFirstParameterValue(params, 'eventBufferingEnabled');
        var eventBufferingEnabled = eventBufferingEnabledS == 'true';
        adjustConfig.setEventBufferingEnabled(eventBufferingEnabled);
    }

    if ('sendInBackground' in params) {
        var sendInBackgroundS = getFirstParameterValue(params, 'sendInBackground');
        var sendInBackground = sendInBackgroundS == 'true';
        adjustConfig.setSendInBackground(sendInBackground);
    }

    if ('userAgent' in params) {
        var userAgent = getFirstParameterValue(params, 'userAgent');
        adjustConfig.setUserAgent(userAgent);
    }

    if ('attributionCallbackSendAll' in params) {
        var _this = this;
        adjustConfig.setAttributionCallbackListener(function(attribution) {
            AdjustTest.addInfoToSend("trackerToken", attribution.trackerToken);
            AdjustTest.addInfoToSend("trackerName", attribution.trackerName);
            AdjustTest.addInfoToSend("network", attribution.network);
            AdjustTest.addInfoToSend("campaign", attribution.campaign);
            AdjustTest.addInfoToSend("adgroup", attribution.adgroup);
            AdjustTest.addInfoToSend("creative", attribution.creative);
            AdjustTest.addInfoToSend("clickLabel", attribution.clickLabel);
            AdjustTest.addInfoToSend("adid", attribution.adid);
            AdjustTest.sendInfoToServer(_this.basePath);
        });
    }

    if ('sessionCallbackSendSuccess' in params) {
        var _this = this;
        adjustConfig.setSessionTrackingSucceededCallbackListener(function(sessionSuccess) {
            AdjustTest.addInfoToSend("message", sessionSuccess.message);
            AdjustTest.addInfoToSend("timestamp", sessionSuccess.timestamp);
            AdjustTest.addInfoToSend("adid", sessionSuccess.adid);
            addJsonResponseInfo(sessionSuccess);
            AdjustTest.sendInfoToServer(_this.basePath);
        });
    }

    if ('sessionCallbackSendFailure' in params) {
        var _this = this;
        adjustConfig.setSessionTrackingFailedCallbackListener(function(sessionFailed) {
            AdjustTest.addInfoToSend("message", sessionFailed.message);
            AdjustTest.addInfoToSend("timestamp", sessionFailed.timestamp);
            AdjustTest.addInfoToSend("adid", sessionFailed.adid);
            AdjustTest.addInfoToSend("willRetry", sessionFailed.willRetry);
            addJsonResponseInfo(sessionFailed);
            AdjustTest.sendInfoToServer(_this.basePath);
        });
    }

    if ('eventCallbackSendSuccess' in params) {
        var _this = this;
        adjustConfig.setEventTrackingSucceededCallbackListener(function(eventSuccess) {
            AdjustTest.addInfoToSend("message", eventSuccess.message);
            AdjustTest.addInfoToSend("timestamp", eventSuccess.timestamp);
            AdjustTest.addInfoToSend("adid", eventSuccess.adid);
            AdjustTest.addInfoToSend("eventToken", eventSuccess.eventToken);
            AdjustTest.addInfoToSend("callbackId", eventSuccess.callbackId);
            addJsonResponseInfo(eventSuccess);
            AdjustTest.sendInfoToServer(_this.basePath);
        });
    }

    if ('eventCallbackSendFailure' in params) {
        var _this = this;
        adjustConfig.setEventTrackingFailedCallbackListener(function(eventFailed) {
            AdjustTest.addInfoToSend("message", eventFailed.message);
            AdjustTest.addInfoToSend("timestamp", eventFailed.timestamp);
            AdjustTest.addInfoToSend("adid", eventFailed.adid);
            AdjustTest.addInfoToSend("eventToken", eventFailed.eventToken);
            AdjustTest.addInfoToSend("callbackId", eventFailed.callbackId);
            AdjustTest.addInfoToSend("willRetry", eventFailed.willRetry);
            addJsonResponseInfo(eventFailed);
            AdjustTest.sendInfoToServer(_this.basePath);
        });
    }

    if ('deferredDeeplinkCallback' in params) {
        var _this = this;
        var launchDeferredDeeplinkS = getFirstParameterValue(params, 'deferredDeeplinkCallback');
        var launchDeferredDeeplink = launchDeferredDeeplinkS === 'true';
        console.log(`[*] Launch deferred deeplink set to: ${launchDeferredDeeplink}`);
        adjustConfig.setShouldLaunchDeeplink(launchDeferredDeeplink);
        adjustConfig.setDeferredDeeplinkCallbackListener(function(uri) {
            AdjustTest.addInfoToSend("deeplink", uri);
            AdjustTest.sendInfoToServer(_this.basePath);
        });
    }
};

AdjustCommandExecutor.prototype.start = function(params) {
    this.config(params);
    var configNumber = 0;
    if ('configName' in params) {
        var configName = getFirstParameterValue(params, 'configName');
        configNumber = parseInt(configName.substr(configName.length - 1))
    }

    var adjustConfig = this.savedConfigs[configNumber];
    Adjust.create(adjustConfig);

    delete this.savedConfigs[0];
};

AdjustCommandExecutor.prototype.event = function(params) {
    var eventNumber = 0;
    if ('eventName' in params) {
        var eventName = getFirstParameterValue(params, 'eventName');
        eventNumber = parseInt(eventName.substr(eventName.length - 1))
    }

    var adjustEvent;
    if (eventNumber in this.savedEvents) {
        adjustEvent = this.savedEvents[eventNumber];
    } else {
        var eventToken = getFirstParameterValue(params, 'eventToken');
        adjustEvent = new AdjustEvent(eventToken);
        this.savedEvents[eventNumber] = adjustEvent;
    }

    if ('revenue' in params) {
        var revenueParams = getValueFromKey(params, 'revenue');
        var currency = revenueParams[0];
        var revenue = parseFloat(revenueParams[1]);
        adjustEvent.setRevenue(revenue, currency);
    }

    if ('callbackParams' in params) {
        var callbackParams = getValueFromKey(params, "callbackParams");
        for (var i = 0; i < callbackParams.length; i = i + 2) {
            var key = callbackParams[i];
            var value = callbackParams[i + 1];
            adjustEvent.addCallbackParameter(key, value);
        }
    }

    if ('partnerParams' in params) {
        var partnerParams = getValueFromKey(params, "partnerParams");
        for (var i = 0; i < partnerParams.length; i = i + 2) {
            var key = partnerParams[i];
            var value = partnerParams[i + 1];
            adjustEvent.addPartnerParameter(key, value);
        }
    }

    if ('orderId' in params) {
        var orderId = getFirstParameterValue(params, 'orderId');
        adjustEvent.setTransactionId(orderId);
    }

    if ('callbackId' in params) {
        var callbackId = getFirstParameterValue(params, 'callbackId');
        adjustEvent.setCallbackId(callbackId);
    }
};

AdjustCommandExecutor.prototype.trackEvent = function(params) {
    this.event(params);
    var eventNumber = 0;
    if ('eventName' in params) {
        var eventName = getFirstParameterValue(params, 'eventName');
        eventNumber = parseInt(eventName.substr(eventName.length - 1))
    }

    var adjustEvent = this.savedEvents[eventNumber];
    Adjust.trackEvent(adjustEvent);

    delete this.savedEvents[0];
};

AdjustCommandExecutor.prototype.setReferrer = function(params) {
    var referrer = getFirstParameterValue(params, 'referrer');
    Adjust.setReferrer(referrer);
};

AdjustCommandExecutor.prototype.pause = function(params) {
    Adjust.onPause('test');
};

AdjustCommandExecutor.prototype.resume = function(params) {
    Adjust.onResume('test');
};

AdjustCommandExecutor.prototype.setEnabled = function(params) {
    var enabled = getFirstParameterValue(params, "enabled") == 'true';
    Adjust.setEnabled(enabled);
};

AdjustCommandExecutor.prototype.setOfflineMode = function(params) {
    var enabled = getFirstParameterValue(params, "enabled") == 'true';
    Adjust.setOfflineMode(enabled);
};

AdjustCommandExecutor.prototype.sendFirstPackages = function(params) {
    Adjust.sendFirstPackages();
};

AdjustCommandExecutor.prototype.gdprForgetMe = function(params) {
    Adjust.gdprForgetMe();
}

AdjustCommandExecutor.prototype.addSessionCallbackParameter = function(params) {
    var list = getValueFromKey(params, "KeyValue");

    for (var i = 0; i < list.length; i = i+2){
        var key = list[i];
        var value = list[i+1];

        Adjust.addSessionCallbackParameter(key, value);
    }
};

AdjustCommandExecutor.prototype.addSessionPartnerParameter = function(params) {
    var list = getValueFromKey(params, "KeyValue");

    for (var i = 0; i < list.length; i = i+2){
        var key = list[i];
        var value = list[i+1];

        Adjust.addSessionPartnerParameter(key, value);
    }
};

AdjustCommandExecutor.prototype.removeSessionCallbackParameter = function(params) {
    if ('key' in params) {
        var list = getValueFromKey(params, 'key');

        for (var i = 0; i < list.length; i++) {
            Adjust.removeSessionCallbackParameter(list[i]);
        }
    }
};

AdjustCommandExecutor.prototype.removeSessionPartnerParameter = function(params) {
    if ('key' in params) {
        var list = getValueFromKey(params, 'key');

        for (var i = 0; i < list.length; i++) {
            Adjust.removeSessionPartnerParameter(list[i]);
        }
    }
};

AdjustCommandExecutor.prototype.resetSessionCallbackParameters = function(params) {
    Adjust.resetSessionCallbackParameters();
};

AdjustCommandExecutor.prototype.resetSessionPartnerParameters = function(params) {
    Adjust.resetSessionPartnerParameters();
};

AdjustCommandExecutor.prototype.setPushToken = function(params) {
    var token = getFirstParameterValue(params, 'pushToken');
    Adjust.setPushToken(token);
};

AdjustCommandExecutor.prototype.openDeeplink = function(params) {
    var deeplink = getFirstParameterValue(params, "deeplink");
    Adjust.appWillOpenUrl(deeplink);
};

AdjustCommandExecutor.prototype.sendReferrer = function(params) {
    var referrer = getFirstParameterValue(params, 'referrer');
    Adjust.setReferrer(referrer);
};

AdjustCommandExecutor.prototype.trackAdRevenue = function(params) {
    var source = getFirstParameterValue(params, 'adRevenueSource');
    var payload = getFirstParameterValue(params, 'adRevenueJsonString');
    Adjust.trackAdRevenue(source, payload);
};

// Util methods //

function addJsonResponseInfo(event) {
    if (event.jsonResponse == null) {
        return;
    }

    if (device.platform === "Android") {
        AdjustTest.addInfoToSend("jsonResponse", event.jsonResponse);
    } else {
        AdjustTest.addInfoToSend("jsonResponse", JSON.stringify(event.jsonResponse));
    }
}

function getValueFromKey(params, key) {
    if (key in params) {
        return params[key];
    }

    return null;
}

function getFirstParameterValue(params, key) {
    if (key in params) {
        var param = params[key];

        if(param != null && param.length >= 1) {
            return param[0];
        }
    }

    return null;
}
